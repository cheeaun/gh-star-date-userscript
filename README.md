# GitHub Star Date Display

A userscript that shows when you starred a GitHub repository as a floating badge.

When you star a GitHub repository, there's no way to see *when* you starred it from the repo page itself. This userscript adds that info as a small floating badge at the bottom-right corner of the viewport.

It works by fetching your starred repos search page (`/stars?q=...`) and extracting the date from there, so no API token or authentication is needed. Results are cached locally to avoid repeated requests.

## Screenshot

![Screenshot](https://greasyfork.s3.us-east-2.amazonaws.com/lakdzj1niatrfbfciwolmzgj1fj7)

## Install

Install from [Greasy Fork](https://greasyfork.org/en/scripts/564752-github-star-date-display).

## License

MIT
