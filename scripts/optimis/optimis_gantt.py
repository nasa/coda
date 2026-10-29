"""Temporary, local OPTIMIS response comparator. Python standard library only.

python scripts/optimis/optimis_gantt.py --date 2026-10-29 --fetch --serve
Add --fetch for a new NTLM snapshot using the existing Node dependency.
"""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import subprocess

HERE = Path(__file__).resolve().parent
OUTPUT = HERE.parent.parent / '.local' / 'optimis-gantt'
UTC = timezone.utc


def instant(value: str) -> datetime:
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if result.tzinfo is None:
        raise ValueError('Source timestamp has no timezone')
    return result.astimezone(UTC)


def list_value(value):
    return value if isinstance(value, list) else ([] if value is None else [value])


def activities_under(node):
    if not isinstance(node, dict):
        return
    children = node.get('children', {})
    for activity in list_value(children.get('activity')):
        yield activity
    for key, items in children.items():
        if key != 'activity':
            for child in list_value(items):
                yield from activities_under(child)


def normalize(response, profiles, date):
    if not isinstance(response, dict) or not isinstance(response.get('plan'), list):
        raise ValueError('Expected the actual activitySearch JSON envelope containing plan[]')
    lo = instant(date + 'T00:00:00Z')
    hi = lo + timedelta(days=1)
    result = {'date': date, 'context': 'ops1', 'activities': [], 'plans': [],
              'profiles': [], 'diagnostics': [], 'sourceCount': 0}
    for plan_index, plan in enumerate(response['plan']):
        plan_key = str(plan_index)
        props = {p['name']: next((p[k] for k in ('integer', 'string', 'time') if k in p), None)
                 for p in plan.get('applicationProperties', [])}
        result['plans'].append({'id': plan_key, 'name': plan.get('name', plan_key),
                                'baseRevision': props.get('viewer.baseRevision'),
                                'subRevision': props.get('viewer.subRevision'),
                                'indexTime': props.get('viewer.baseIndexTime')})
        for item in activities_under(plan):
            result['sourceCount'] += 1
            try:
                start = instant(item['startTime'])
                duration = float(item['duration'])
                if not 0 <= duration < 100 * 365 * 86400:
                    raise ValueError('Invalid duration')
                end = start + timedelta(seconds=duration)
                if not (start < hi and end > lo or duration == 0 and lo <= start < hi):
                    continue
                p = item.get('sharedProperties', {})
                result['activities'].append({
                    'id': item['id'], 'plan': plan_key, 'name': item.get('name', item['id']),
                    'start': (start - lo).total_seconds(), 'end': (end - lo).total_seconds(),
                    'startTime': start.isoformat(), 'endTime': end.isoformat(), 'duration': duration,
                    'type': item.get('activityType', ''), 'scheduled': item.get('scheduled'),
                    'status': p.get('activityStatus', 'Unavailable'), 'sequence': p.get('activitySequence', ''),
                    'crew': list_value(p.get('crewMembers')), 'events': list_value(p.get('events')),
                    'category': p.get('filterCategory3', ''), 'location': p.get('location', ''),
                    'containers': p.get('restAncestorContainerNames', ''),
                    'timeCritical': bool(p.get('timeCritical')),
                })
            except (KeyError, ValueError, TypeError, OverflowError) as error:
                result['diagnostics'].append({'id': item.get('id'), 'error': str(error)})
    for profile in profiles:
        points = []
        for point in profile.get('dataPoints', []):
            start, end = instant(point['startTime']), instant(point['endTime'])
            if start < hi and end > lo:
                points.append({'start': (start-lo).total_seconds(), 'end': (end-lo).total_seconds(),
                               'value': point.get('value')})
        result['profiles'].append({'id': profile['id'], 'name': profile.get('name', profile['id']),
                                   'project': profile.get('project'), 'revision': profile.get('rev'),
                                   'points': points})
    result['statusCounts'] = dict(Counter(a['status'] for a in result['activities']))
    return result


def render(date):
    activity_file = OUTPUT / 'data' / f'activities-{date}.json'
    profile_file = OUTPUT / 'data' / f'profiles-{date}.json'
    metadata_file = OUTPUT / 'data' / f'metadata-{date}.json'
    data = normalize(json.loads(activity_file.read_text(encoding='utf-8')),
                     json.loads(profile_file.read_text(encoding='utf-8')), date)
    data['fetchedAt'] = (json.loads(metadata_file.read_text(encoding='utf-8'))['fetchedAt']
                         if metadata_file.exists() else datetime.fromtimestamp(activity_file.stat().st_mtime, UTC).isoformat())
    serialized = json.dumps(data, ensure_ascii=True, allow_nan=False).replace('<', '\\u003c')
    output = OUTPUT / 'viewer.html'
    output.write_text((HERE / 'viewer-template.html').read_text(encoding='utf-8').replace('__DATA__', serialized), encoding='utf-8')
    (OUTPUT / 'data' / f'normalized-{date}.json').write_text(serialized, encoding='utf-8')
    print(f"Rendered {len(data['activities'])} activities from {len(data['plans'])} plans; "
          f"{len(data['profiles'])} profiles; {len(data['diagnostics'])} parsing errors.")
    print(output)
    return output


def serve(output, port):
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path.split('?', 1)[0] not in ('/', '/viewer.html'):
                self.send_error(404)
                return
            payload = output.read_bytes()
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(payload)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.end_headers()
            self.wfile.write(payload)
        def log_message(self, *_args):
            pass
    print(f'Local comparison: http://127.0.0.1:{port}/', flush=True)
    ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--date', default=datetime.now(UTC).date().isoformat())
    parser.add_argument('--fetch', action='store_true', help='Fetch one day from production using NTLM')
    parser.add_argument('--refresh', action='store_true', help='Bypass the 15-minute snapshot reuse')
    parser.add_argument('--serve', action='store_true')
    parser.add_argument('--port', type=int, default=8766)
    args = parser.parse_args()
    instant(args.date + 'T00:00:00Z')
    if args.fetch:
        subprocess.run(['node', str(HERE/'fetch.mjs'), args.date] + (['--refresh'] if args.refresh else []), check=True)
    output = render(args.date)
    if args.serve:
        serve(output, args.port)
