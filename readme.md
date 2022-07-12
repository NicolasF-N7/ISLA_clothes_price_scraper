# How to run this repo on Glitch.com
## Setup
1. npm install
2. puppeteer.launch({ headless: true , args: ['--no-sandbox']})

## Run
1. node app.js
2. refresh (to see the data written to files, if any)
3. Look into results/Prices_results.csv

## Edit brand & clothes to search for
Inside config.json, add what you want to research under the attribute 'research_queries' with the synthax ["first term", "second term", "third term"].
