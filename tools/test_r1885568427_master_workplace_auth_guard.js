const fs=require('fs'),path=require('path');const code=fs.readFileSync(path.resolve(__dirname,'../js/next/pages/master_workplace.js'),'utf8');
const expect=(c,m)=>{if(!c)throw new Error(m)};
expect(/auth-required/.test(code),'master workplace auth-required phase missing');
expect(/context\?\.state\?\.identity\?\.authenticated/.test(code),'identity auth guard missing');
const mountStart=code.indexOf('function mountMasterWorkplace');const apiCall=code.indexOf('apiModule.get',mountStart);const guard=code.indexOf("if(!authenticated)",mountStart);
expect(guard>mountStart&&guard<apiCall,'auth guard must run before masterWorkplace.get');
console.log('R188.5.5.6.84.27 master workplace auth guard OK');
