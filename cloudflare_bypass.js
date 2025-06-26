import puppeteer from "puppeteer-core"

const query = new URLSearchParams({
  token: "sk_1XzzOVbzhwxbbJJCNM2RJrPva2mrC5Tu1nlpBfgImEe0TMe0stSFl720cZVo9Kjn",
  proxy_country: "CO",
  session_recording: true,
  session_ttl: 900,
  session_name: "reCAPTCHA V2",
})

const connectionURL = `wss://browser.scrapeless.com/browser?${query.toString()}`

const browser = await puppeteer.connect({
  browserWSEndpoint: connectionURL,
  defaultViewport: null,
})

const NIT = "900434863"; // Puedes cambiar este valor por el NIT que desees consultar

example("https://muisca.dian.gov.co/WebRutMuisca/DefConsultaEstadoRUT.faces")

async function example(url) {
  try {
    const page = await browser.newPage()
    // Escuchar eventos de captcha
    const captchaPromise = addCaptchaListener(page)
    console.log("Navigated to URL:", url)
    await page.goto(url, { timeout: 60000, waitUntil: "domcontentloaded" })
    await page.screenshot({ path: "debug-before-wait.png", fullPage: true })
    console.log("Esperando que la página esté lista después de Cloudflare o reCAPTCHA...")
    await onCaptchaFinished(captchaPromise)
    await waitChallenge(page, "form");
    await page.screenshot({ path: "debug-after-wait.png", fullPage: true })
    console.log("Página lista y Cloudflare/reCAPTCHA resuelto.")

    // Usar el selector correcto para el campo NIT
    const selectorNIT = "#vistaConsultaEstadoRUT\\:formConsultaEstadoRUT\\:numNit";
    const selectorBuscar = "#vistaConsultaEstadoRUT\\:formConsultaEstadoRUT\\:btnBuscar";

    // Captura antes de buscar el campo NIT
    await page.screenshot({ path: "debug-before-nit.png", fullPage: true });

    // Esperar a que el campo NIT esté disponible (más tiempo)
    await page.waitForSelector(selectorNIT, { timeout: 30000 });
    await page.click(selectorNIT, { clickCount: 3 }); // Selecciona todo el texto si hay
    await page.type(selectorNIT, NIT, { delay: 100 });
    console.log("NIT ingresado");

    // Hacer clic en el botón Buscar
    await page.waitForSelector(selectorBuscar, { timeout: 15000 });
    await page.click(selectorBuscar);
    console.log("Botón Buscar presionado, esperando resultados...");

    // Esperar a que aparezca el resultado (puedes ajustar el selector según el resultado esperado)
    const selectorResultado = "#vistaConsultaEstadoRUT\\:formConsultaEstadoRUT\\:j_idt31";
    await page.waitForSelector(selectorResultado, { timeout: 20000 }).catch(() => {});
    await page.screenshot({ path: "debug-result.png", fullPage: true });

    // Extraer los resultados visibles
    const resultado = await page.evaluate((selectorResultado) => {
      const resultadoDiv = document.querySelector(selectorResultado);
      return resultadoDiv ? resultadoDiv.innerText : document.body.innerText;
    }, selectorResultado);
    console.log("Resultado de la consulta:", resultado);
  } catch (error) {
    console.error(error)
  } finally {
    await browser.close()
    console.log("Navegador cerrado")
  }
}

async function waitChallenge(page, selector) {
  await page.waitForSelector(selector, { timeout: 60000 })
  console.log("Selector encontrado:", selector)
}

async function addCaptchaListener(page) {
  return new Promise(async (resolve) => {
    const client = await page.createCDPSession()
    client.on("Captcha.detected", (msg) => {
      console.log("Captcha.detected:", msg)
    })
    client.on("Captcha.solveFinished", async (msg) => {
      console.log("Captcha.solveFinished:", msg)
      resolve(msg)
      client.removeAllListeners()
    })
  })
}

async function onCaptchaFinished(promise, timeout = 60_000) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject("Timeout"), timeout))])
}
