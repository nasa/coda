# CODA

_Collaborative Operations Data Activation_

Consolidating the context of missions, training, and testing into an easy to use platform to relive and revisit each moment. For more info, see https://wiki.jsc.nasa.gov/exploration/index.php/CODA.

## Development

### First Time Installation

1. Setup the right version of Node using nvm: `nvm install && nvm use`
2. Install dependencies: `npm i`

Next, change your hosts file to map `coda-iss.develop` to `localhost`.

Then head over to `http://coda-iss.develop:8000`.

## API Info

### Imagery Online (IO)

From James Montalvo

```
James Montalvo 4 minutes ago
Video is coming down real time, and at each LOS a new video file is cut. This makes most video files on an EVA day (when we're TDRS-critical and have lots of comm coverage) average around 30-40 minutes long, I think.

James Montalvo 4 minutes ago
So the fastest they could possibly get onto IO would be that 30-40 minutes...

James Montalvo 4 minutes ago
or, if you care about something that happened in the video right after an LOS, you're gonna wait that 30-40 minutes minimum for it.

James Montalvo 2 minutes ago
Around the start of the EVA the imagery curators (not sure if that's what they call themselves) start supporting the EVA. It is their job to take in the new video files and make sure they are properly annotated. In the last couple years, and especially since COVID, we've brought them into a Teams (in the past Skype) meeting to make it easier for them to stay up to speed with what's happening. This makes their annotations more accurate and faster.

James Montalvo 2 minutes ago
But it still adds a delay.

James Montalvo 1 minute ago
Early in the EVA they're pretty quick. Probably 0-5 minutes added time.

James Montalvo < 1 minute ago
Later in the day either due to fatigue or having to support other things or backlog of videos it seems to take longer

Another source of delay may be latency transferring from MCC to Building 8.

James Montalvo  < 1 minute ago
Since LOS applies to all downlinks, you're cutting 6 new files simultaneously

James Montalvo  < 1 minute ago
some of them HD
```
