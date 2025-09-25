(()=>{var u="membres";var p="AssociationDB",c="membres",a=null;function i(){return"indexedDB"in window}function g(){return a||(i()?(a=new Promise((e,n)=>{let o=indexedDB.open(p,1);o.onupgradeneeded=r=>{let t=r.target.result;t.objectStoreNames.contains(c)||t.createObjectStore(c,{keyPath:"code"})},o.onsuccess=r=>e(r.target.result),o.onerror=r=>n(r.target.error)}),a):Promise.resolve(null))}async function m(){let e=await g();return e?new Promise((n,o)=>{let s=e.transaction(c,"readonly").objectStore(c).getAll();s.onsuccess=()=>n(s.result),s.onerror=()=>o(s.error)}):[]}function d(){return JSON.parse(localStorage.getItem(u)||"[]")}async function l(){let e=document.getElementById("membersContainer"),n=[];try{i()?n=await m():n=d()}catch(t){console.error("Erreur en chargeant les membres",t),n=d()}if(!e)return;if(n.length===0){e.innerHTML="<p>Aucun membre enregistr\xE9.</p>";return}let o=document.createElement("table");o.innerHTML=`
    <thead><tr><th>Code</th><th>Nom</th><th>Sexe</th><th>T\xE9l\xE9phone</th><th>Montant</th><th>Adh\xE9sion</th><th>Actions</th></tr></thead>
  `;let r=document.createElement("tbody");n.forEach(t=>{let s=document.createElement("tr");s.innerHTML=`<td><span class="badge-code">${t.code}</span></td>
      <td>${t.nom}</td>
      <td>${t.sexe||""}</td>
      <td>${t.telephone||""}</td>
      <td>${t.montant||0} FC</td>
      <td>${t.dateAdhesion||""}</td>
      <td>
        <button onclick="deleteMember('${t.code}')">Supprimer</button>
      </td>`,r.appendChild(s)}),e.innerHTML="",o.appendChild(r),e.appendChild(o)}document.addEventListener("DOMContentLoaded",function(){l()});async function f(){let e=[];try{e=i()?await m():d()}catch{e=d()}let n=document.getElementById("memberCount");n&&(n.textContent=String(e.length||0))}var b=l;l=async function(){await b(),f()};})();
