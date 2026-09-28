(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const normalize = value => String(value || '').toLocaleLowerCase('ru-RU').trim();
  const groups = [
    {key:'services',label:'Услуги',icon:'⚙',path:'#/services',fields:['name','title','category_name','description']},
    {key:'masters',label:'Мастера и СТО',icon:'◉',path:'#/masters',fields:['name','title','specialization','city']},
    {key:'parts',label:'Запчасти',icon:'▣',path:'#/parts',fields:['name','title','brand','category_name']},
    {key:'orders',label:'Заявки',icon:'▤',path:'#/orders',fields:['title','description','vehicleLabel','status']},
    {key:'news',label:'Публикации',icon:'◎',path:'#/works',fields:['title','intro','summary','body']},
    {key:'workPosts',label:'Работы',icon:'▥',path:'#/real-works',fields:['title','vehicleLabel','description','authorName']}
  ];
  function arrays(snapshot){
    const p=snapshot?.payload||snapshot||{};
    const d=p.data&&typeof p.data==='object'?p.data:p;
    return {
      services:d.services||d.serviceOffers||[], masters:d.masters||d.providers||[], parts:d.parts||d.products||[],
      orders:d.orders||d.workOrders||[], news:d.news||d.posts||[], workPosts:d.workPosts||d.works||[]
    };
  }
  function search(snapshot, query){
    const q=normalize(query); if(!q) return [];
    const source=arrays(snapshot); const out=[];
    groups.forEach(group=>{
      (Array.isArray(source[group.key])?source[group.key]:[]).forEach((item,index)=>{
        const hay=normalize(group.fields.map(f=>item?.[f]).filter(Boolean).join(' '));
        if(!hay.includes(q)) return;
        const title=item.name||item.title||item.vehicleLabel||`${group.label} ${index+1}`;
        const text=item.description||item.summary||item.intro||item.category_name||item.specialization||'';
        const id=item.id||item.uuid||'';
        let href=group.path;
        if(group.key==='parts'&&id) href=`#/parts/item/${encodeURIComponent(id)}`;
        if(group.key==='workPosts'&&id) href=`#/works/item/${encodeURIComponent(id)}`;
        if(group.key==='orders'&&id) href=`#/orders/item/${encodeURIComponent(id)}`;
        out.push({group:group.label,icon:group.icon,title,text,href});
      });
    });
    return out.slice(0,60);
  }
  window.KaretaPlatformSearch=Object.freeze({search,groups});
})();
