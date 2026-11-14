import assert from "node:assert/strict";

const homepage = "https://www.movidasst.com/";
const metrics = "https://metricas.movidasst.com/resumen-ecosistema.json";
const destinations = [
  homepage,
  new URL("biblioteca/", homepage).href,
  new URL("tv/", homepage).href,
  new URL("mi-movida/", homepage).href,
  "https://inscripciones.movidasst.com/",
  "https://directorio.movidasst.com/",
  "https://laboratorio.movidasst.com/",
];

async function read(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
      if (response.ok) return await response.text();
      throw new Error("HTTP " + response.status);
    } catch (error) {
      if (attempt === 2) throw new Error(url + " · " + error.message);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
}

const results = await Promise.allSettled([
  ...destinations.map(async url => {
    assert.ok((await read(url)).length > 0, url + " devolvió un cuerpo vacío");
    console.log("OK", url);
  }),
  (async () => {
    const summary = JSON.parse(await read(metrics));
    assert.ok(Number.isSafeInteger(summary.total?.views) && summary.total.views >= 0, "Total de vistas inválido");
    const cut = summary.views_date_to ?? summary.date_to;
    const cutoff = Date.parse(cut + "T00:00:00Z");
    const age = (Date.now() - cutoff) / 86400000;
    assert.ok(age >= -1 && age <= 4, "Corte GA4 fuera del rango esperado · " + cut);
    console.log("OK", metrics, cut);
  })(),
]);

for (const result of results) {
  if (result.status === "rejected") {
    console.error(result.reason.message);
    process.exitCode = 1;
  }
}
