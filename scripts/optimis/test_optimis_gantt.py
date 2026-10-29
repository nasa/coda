"""Offline checks for interpreting the upstream response, without real schedule data."""
from copy import deepcopy
import contextlib
import io
import json
from pathlib import Path
import re
import tempfile
import unittest
from unittest.mock import patch

from optimis_gantt import instant, normalize, render


class NormalizeTests(unittest.TestCase):
    def activity(self, identifier, start, duration):
        return {'id': identifier, 'name': 'Synthetic activity', 'activityType': 'Activity',
                'startTime': start, 'duration': duration, 'scheduled': True,
                'sharedProperties': {'crewMembers': ['FE-2'], 'events': ['CREW'],
                                     'activityStatus': 'Scheduled Enabled'}}

    def response(self, activities):
        return {'plan': [{'name': 'SYNTHETIC.OPS1', 'children': {'activity': activities}}]}

    def test_half_open_day_keeps_crossing_intervals_and_start_milestone(self):
        records = [
            self.activity('ending-at-start', '2026-10-28T23:00:00Z', '3600'),
            self.activity('crossing-start', '2026-10-28T23:30:00Z', '3600'),
            self.activity('start-milestone', '2026-10-29T00:00:00Z', '0'),
            self.activity('crossing-end', '2026-10-29T23:30:00Z', '3600'),
            self.activity('starting-at-end', '2026-10-30T00:00:00Z', '3600'),
            self.activity('end-milestone', '2026-10-30T00:00:00Z', '0'),
        ]
        result = normalize(self.response(records), [], '2026-10-29')
        self.assertEqual([a['id'] for a in result['activities']],
                         ['crossing-start', 'start-milestone', 'crossing-end'])
        self.assertEqual(result['activities'][0]['start'], -1800)
        self.assertEqual(result['activities'][-1]['end'], 88200)
        self.assertEqual(result['sourceCount'], 6)

    def test_duration_is_seconds_and_notes_are_not_exposed(self):
        record = self.activity('example', '2026-10-29T12:30:00Z', '90')
        record['sharedProperties'].update({'crewNote': 'PRIVATE', 'isCrewNotePrivate': True,
                                          'groundNote': 'INTERNAL', 'executionNotes': [{'structure': {'stepsAndNotes': 'LINK NOTE'}}]})
        source = self.response([record])
        original = deepcopy(source)
        activity = normalize(source, [], '2026-10-29')['activities'][0]
        self.assertEqual(activity['end'] - activity['start'], 90)
        self.assertEqual(activity['crew'], ['FE-2'])
        self.assertNotIn('PRIVATE', str(activity))
        self.assertNotIn('INTERNAL', str(activity))
        self.assertNotIn('LINK NOTE', str(activity))
        self.assertEqual(source, original)

    def test_invalid_timestamps_and_durations_are_reported(self):
        records = [self.activity('naive', '2026-10-29T12:30:00', '60'),
                   self.activity('negative', '2026-10-29T12:30:00Z', '-1'),
                   self.activity('nan', '2026-10-29T12:30:00Z', 'NaN')]
        result = normalize(self.response(records), [], '2026-10-29')
        self.assertEqual(result['activities'], [])
        self.assertEqual(len(result['diagnostics']), 3)
        with self.assertRaises(ValueError):
            instant('2026-10-29T12:30:00')

    def test_profile_values_preserve_types_and_missing_series(self):
        profiles = [{'id': 'ALL_S2_AVAIL'}, {'id': 'DAILY_ORB_NUM', 'dataPoints': [
            {'startTime': '2026-10-28T23:30:00Z', 'endTime': '2026-10-29T01:00:00Z', 'value': '3'}]}]
        result = normalize(self.response([]), profiles, '2026-10-29')
        self.assertEqual(result['profiles'][0]['points'], [])
        self.assertEqual(result['profiles'][1]['points'][0]['value'], '3')
        self.assertEqual(result['profiles'][1]['points'][0]['start'], -1800)

    def test_wrong_response_envelope_is_rejected(self):
        with self.assertRaises(ValueError):
            normalize({'Dictionary': {}}, [], '2026-10-29')

    def test_rendered_payload_round_trips_html_like_activity_names(self):
        record = self.activity('markup', '2026-10-29T12:30:00Z', '90')
        record['name'] = '</script><script>untrusted activity name</script>'
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary)
            (output / 'data').mkdir()
            (output / 'data' / 'activities-2026-10-29.json').write_text(
                json.dumps(self.response([record])), encoding='utf-8')
            (output / 'data' / 'profiles-2026-10-29.json').write_text('[]', encoding='utf-8')
            with patch('optimis_gantt.OUTPUT', output), contextlib.redirect_stdout(io.StringIO()):
                page = render('2026-10-29').read_text(encoding='utf-8')
            payload = re.search(r'<script id="source-data" type="application/json">(.*?)</script>',
                                page, re.DOTALL).group(1)
            self.assertNotIn('<', payload)
            self.assertEqual(json.loads(payload)['activities'][0]['name'], record['name'])


if __name__ == '__main__':
    unittest.main()
