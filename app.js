// puppeteer-extra is a drop-in replacement for puppeteer,
// it augments the installed puppeteer with plugin functionality.
// Any number of plugins can be added through `puppeteer.use()`
const puppeteer = require('puppeteer-extra')
const fs = require('fs')
//Import config file from CL arguments OR config.json by default
let config = null;
const args = process.argv.slice(2);
if(args.length > 0){config = require(args[0]);}
else{config = require('./config.json');}

// Add stealth plugin and use defaults (all tricks to hide puppeteer usage)
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())

// Add adblocker plugin to block all ads and trackers (saves bandwidth)
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker')
puppeteer.use(AdblockerPlugin({ blockTrackers: true }))

// That's it, the rest is puppeteer usage as normal 😊
puppeteer.launch({ headless: false }).then(async browser => {
  const page = await browser.newPage()

  const navigationPromise = page.waitForNavigation()

  await page.setViewport({
    width: 1024,
    height: 720,
    deviceScaleFactor: 1,
  });

  //====Inject cookies====
  let newDataLine = '';
  //For each research query
  for(let researchQuery of config.research_queries){
    console.log('---' + researchQuery + '---');
    newDataLine += researchQuery + ',';

    //For each MARKETPLACE
    let priceList = [];
    for(let marketpl of config.marketplaces_to_visit){
      //Set cookies
      const cookies = fs.readFileSync(marketpl.cookiesFile, 'utf8');
    	const deserializedCookies = JSON.parse(cookies);
    	await page.setCookie(...deserializedCookies);

      //===LOOP to scrape data from several result PAGES===
      for(let i=1; i < marketpl.number_pages_to_scrape+1; i++){
        let searchURL = marketpl.baseURL + marketpl.pagePrefix + i + marketpl.searchPrefix + encodeURI(researchQuery) + marketpl.searchPostfix;

        //===Connect to webpage until successful connection (avoid problems due to connectivity interuption)===
    		let connectionSuccess = false;
    		let nbTrials = 0;
    		while(nbTrials < config.connectionMaxTrial && !connectionSuccess){
    			try{
    				//await page.goto(searchURL, {waitUntil : 'domcontentloaded'});
            await page.goto(searchURL);
    				connectionSuccess = true;
    			}catch(err){
    				console.log("NO INTERNET. Trying again in 15 sec");
    				await page.waitForTimeout(15000);
    			}
    			nbTrials++;
    		}
    		if(nbTrials > 1){console.log("Internet is baaack!");}

        //Gather all prices elements
        //Looking for elements: <span _ngcontent-vc-app-c143="" itemprop="price" hidden="">
        //Solution 3 - Search directly for price elements
        let priceSelector = "#main-content > catalog-page > vc-catalog > div > div > ais-instantsearch > div > div.catalog__columnProductList > div.catalog__resultContainer > ais-hits > div > ul > li > vc-catalog-snippet > div > div.productSnippet__infos > span > span[itemprop='price']";

        let priceHTMLElementList;
        try{
          //Retrieve the list of <span> element containing the price
          await page.waitForSelector(priceSelector);
          priceHTMLElementList = await page.$$(priceSelector);
          console.log(priceHTMLElementList.length + " items scraped on the page " + i);

          //Extract prices from <spam> elements, and store it into priceList
          for(itemContainer of priceHTMLElementList){
            //Try to find the price if initial price is displayed (thus discount also)
            let price = await itemContainer.getProperty('innerText');
            price = await price.jsonValue();

            //Add price to gathered price list
            let floatPrice = parseFloat(price);
            if(isNaN(floatPrice)){console.log("Price not found");}
            else{priceList.push(floatPrice);}
          }
        }catch(err){
          //If not as much items as the number of pages set in the config file, stop the page loop here, and finish by writing the data
          console.log("Not a single price element not found");
          break;
        }
      }

      console.log("Prices on " + marketpl.name + " for the research: ");

      let avgPrice = (priceList.reduce((a, b) => a + b, 0) / priceList.length).toFixed(2);
      console.log("Average price: " + avgPrice);
      newDataLine += priceList.length + ',' + avgPrice + ',' + Math.min(...priceList) + ',' + Math.max(...priceList) + ',' + priceList.toString();

    }
    newDataLine += '\n';

  }

  //===Append the new data to the excel===
	fs.appendFile(config.outputDataSheet, newDataLine, 'utf8', (err) => {
	  if (err)
	    console.log(err);
	  else {
	    console.log("\nData written to file!\n");
	  }
	});
  browser.close();

})
