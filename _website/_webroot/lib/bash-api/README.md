NASA MediaWiki API via Bash
===========================

Prerequisites
-------------

1. Speak with James Montalvo about getting your username/password setup to access wiki.jsc.nasa.gov without LaunchPad
2. `curl` installed
3. [`jq`](https://stedolan.github.io/jq/) installed
4. Not required on wiki-dev, perhaps required on wiki-int or production: CA Certificate obtained from [NTAM](https://etads.nasa.gov/idi/ntam/) and added to this repo's directory as `cacert.pem` or with path specified in your config.
5. Copy `config.example.sh` and fill in the appropriate values (do not set a CA cert for wiki-dev)

Usage
-----

### Commands

```bash
# all pages
bash allpages.sh
LIMIT=5 START=PGT bash allpages.sh

# recent changes
bash recentchanges.sh

# Get page info including wikitext
bash page-wikitext.sh
TITLE="Flex_Hose_Rotary_Coupler" bash page-wikitext.sh

# Get page info including HTML
bash page-html.sh
TITLE=PGT bash page-html.sh
```

### Get a list of all pages

Get a list of all pages on a wiki. Note that you're limited to 5000 records per query. Use `START` and `LIMIT` to page through the results.

If you run the following command, you'll be prompted for number of results to return.

```bash
$ bash allpages.sh
````

Without any inputs, you'll be prompted for number of records to return.

```
Integer value of records to return: 5
```

The response will look like:

```json
{
  "batchcomplete": "",
  "continue": {
    "apcontinue": "0.5\"_SPD",
    "continue": "-||"
  },
  "query": {
    "allpages": [
      {
        "pageid": 5073,
        "ns": 0,
        "title": "*Ubiquitous"
      },
      {
        "pageid": 28543,
        "ns": 0,
        "title": "0.25” BDT"
      },
      {
        "pageid": 17303,
        "ns": 0,
        "title": "0.5\" Arm Sizing Ring"
      },
      {
        "pageid": 19889,
        "ns": 0,
        "title": "0.5\" QD Bootie Extender"
      },
      {
        "pageid": 5978,
        "ns": 0,
        "title": "0.5\" QD Spool Positioning Device"
      }
    ]
  }
}
```

`LIMIT` and `START` (AKA "offset") can be specified as follows:

```
$ LIMIT=5 START=PGT bash allpages.sh
```

to provide output like:

```json
{
  "batchcomplete": "",
  "continue": {
    "apcontinue": "PGT_TAK",
    "continue": "-||"
  },
  "query": {
    "allpages": [
      {
        "pageid": 462,
        "ns": 0,
        "title": "PGT"
      },
      {
        "pageid": 6240,
        "ns": 0,
        "title": "PGT Battery"
      },
      {
        "pageid": 332,
        "ns": 0,
        "title": "PGT FQD ARGOS"
      },
      {
        "pageid": 25624,
        "ns": 0,
        "title": "PGT Lesson Plan"
      },
      {
        "pageid": 6242,
        "ns": 0,
        "title": "PGT NiMH Battery"
      }
    ]
  }
}
```

### Recent changes

```bash
bash recentchanges.sh
```

This will provide the most recently changed pages.

### Page HTML and Wikitext

The following two commands can be run to get page HTML and wikitext, respectively:

```bash
bash page-html.sh
bash page-wikitext.sh
```

Both of these will prompt for page name. Note that **this value is not URL encoded, so you must do that yourself.** Spaces may be replaced with underscores.

Additionally, specifying `TITLE` can be done:

```bash
TITLE=PGT bash page-html.sh
TITLE="Flex_Hose_Rotary_Coupler" bash page-wikitext.sh
```
