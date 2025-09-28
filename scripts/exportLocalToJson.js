(async function exportLocalToJson(){
  function loadLocalKey(key){ try{ return JSON.parse(localStorage.getItem(key) || '[]'); }catch(e){ return []; } }
  // try to read indexedDB members if available
  async function idbGetAllSafe(){ if(!window.idbGetAll) return null; try{ return await window.idbGetAll(); }catch(e){ return null; } }
  const membersIdb = await idbGetAllSafe();
  const members = membersIdb && membersIdb.length ? membersIdb : loadLocalKey('membres');
  const depots = loadLocalKey('depots');
  const payouts = loadLocalKey('payouts');
  const out = { members, depots, payouts };
  // print JSON to console for copy/paste into db.json
  console.log('==== COPY THE FOLLOWING JSON INTO db.json ====');
  console.log(JSON.stringify(out, null, 2));
  return out;
})(); 