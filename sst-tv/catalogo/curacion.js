/* SST TV: public visibility rules, safely readable without an admin session. */
(function () {
  'use strict';
  const SUPABASE_URL = 'https://lfdmbkzghnwvsapxypvt.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_bRnkA6PA8-v073nrw9zxiQ_8rVGiOn1';
  async function rules() {
    try {
      const response = await fetch(
        SUPABASE_URL + '/rest/v1/sst_tv_visibilidad?select=tipo,referencia,oculto&order=tipo,referencia',
        {headers: {'apikey': SUPABASE_KEY, 'Accept': 'application/json'}, cache: 'no-store'}
      );
      if (!response.ok) throw new Error('Visibilidad API: ' + response.status);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('Respuesta incorrecta');
      return data;
    } catch (error) {
      console.warn('SST TV: no se pudo consultar la moderación; se usará la última configuración publicada.', error);
      return null;
    }
  }
  function hiddenIds(snapshot, currentRules) {
    if (!Array.isArray(currentRules)) return new Set(snapshot.hiddenVideoIds || []);
    const hidden = new Set();
    for (const item of currentRules) {
      if (item.tipo === 'video' && item.oculto === true) hidden.add(item.referencia);
    }
    const playlists = snapshot.playlistVideoIds || {};
    for (const item of currentRules) {
      if (item.tipo === 'playlist' && item.oculto === true) {
        for (const id of playlists[item.referencia] || []) hidden.add(id);
      }
    }
    return hidden;
  }
  window.SSTTVCuration = Object.freeze({rules, hiddenIds, url: SUPABASE_URL, key: SUPABASE_KEY});
})();
