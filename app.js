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
  /*Cookies for
  https://www.vestiairecollective.com/
  https://www.depop.com
  https://hardlyeverwornit.com/
  https://www.etsy.com/
  NOPE https://www.grailed.com/
  https://www.videdressing.com/
  https://theluxurycloset.com/
  https://thevintagebar.com/
  NOPE https://www.myprivateboutique.ch/
  */

  /* Brands already assessed
  "Fusalp", "Balmain", "Valentino", "Salvatore Ferragamo", "Tod's", "Jimmy Choo", "Christian Louboutin", "Fendi", "Saint Laurent", "Bulgari", "Dolce and Gabbana", "Rolex", "Cartier", "Prada", "Burberry", "Dior", "Hermes", "Gucci", "Louis Vuitton", "Chanel"

  */

  let newDataLine = '';
  //For each BRAND
  for(let brandName of config.brands_to_process){
    console.log('---' + brandName + '---');
    newDataLine += brandName + ',';

    //For each MARKETPLACE
    for(let marketpl of config.marketplaces_to_visit){
      //Set cookies
      const cookies = fs.readFileSync(marketpl.cookiesFile, 'utf8');
    	const deserializedCookies = JSON.parse(cookies);
    	await page.setCookie(...deserializedCookies);

      let searchURL = marketpl.baseURL + marketpl.searchPrefix + encodeURI(brandName) + marketpl.searchPostfix;

      //===Connectivity trial===
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

      //Scan SELECTORS
      let totalVisib = 0;
      for(selector of marketpl.selectors){
        try{
          await page.waitForSelector(selector);
          let selectorTextContent = await page.$eval(selector, el => el.textContent);
          //Filter non numeric character
          let cleanedNumberContent = selectorTextContent.replace(/[^\d.-]/g, '');
          if(isNaN(parseInt(cleanedNumberContent))){
            totalVisib += 0;
          }else{
            totalVisib += parseInt(cleanedNumberContent);
          }
        }catch(err){
          console.log("Element not found: " + selector);
          //await page.waitForTimeout(15000000);
        }

      }
      console.log(marketpl.name + " totalVisib: " + totalVisib);
      newDataLine += totalVisib + ',';

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
