
"use strict";
(() => {
  const { text: t } = globalThis.KairoInventoryLocale;
  const config=globalThis.KairoInventoryConfig;
  const prefix="kairo-inventory:";
  const send=(name,value={})=>Events.emitServer(prefix+name,JSON.stringify(value));
  const notify=message=>Game.notify?.("[" + t("title") + "] "+message);
  const family={
    broom:typeof Broom==="undefined"?null:Broom,
    flying:typeof FlyingMount==="undefined"?null:FlyingMount,
    ground:typeof GroundMount==="undefined"?null:GroundMount
  };
  let view=-1,ready=false,visible=false,requested=false,showPending=false,lease=null,openingTimer=null;
  const waiting=[];
  function deliver(event,value){
    if(ready&&view>=0) Web.emit(view,event,value);
    else waiting.push([event,value]);
  }
  function parse(raw){
    if(typeof raw!=="string")return raw;
    try{return JSON.parse(raw)}catch{return null}
  }
  function hide(){
    clearTimeout(openingTimer);
    requested=false;visible=false;showPending=false;
    waiting.length=0;
    try{if(view>=0)Web.hideView(view)}finally{lease?.release();lease=null}
  }
  function requestClose(){
    hide();
    send("close");
  }
  function show(){
    if(!requested||!ready||view<0)return;
    clearTimeout(openingTimer);
    try{
      const input=Imports.get("hmp-lib")?.input;
      lease=input?.controls?.acquire?.({resource:"hmp-inventory",id:"screen"})||null;
    }catch{}
    try{
      Web.showView(view);Web.focusView(view);
      visible=true;
    }catch{
      requestClose();notify(t("screen"));
    }
  }
  function prepare(){
    if(view>=0)return true;
    if(typeof Web==="undefined"||typeof Web.createView!=="function")return false;
    try{
      view=Web.createView("fw://resources/hmp-inventory/ui/index.html",{visible:false});
      if(view<0)return false;
      Web.on(view,"ready",()=>{
        ready=true;
        Web.emit(view,"configure",{key:config.inventory||"",language:globalThis.KairoInventoryLocale.language,messages:globalThis.KairoInventoryLocale.messages});
        for(const [event,value] of waiting.splice(0))Web.emit(view,event,value);
        if(showPending)show();
      });
      Web.on(view,"close",requestClose);
      Web.on(view,"action",raw=>{
        const data=parse(raw);
        if(!visible||typeof data?.key!=="string"||typeof data?.action!=="string"){
          deliver("error",{message:t("invalid")});
          return;
        }
        try{send("action",data)}catch{deliver("error",{message:t("sendFailed")})}
      });
      return true;
    }catch{
      if(view>=0)try{Web.destroyView(view)}catch{}
      view=-1;ready=false;
      return false;
    }
  }
  function open(){
    if(requested||visible)return;
    if(!prepare()){notify(t("screen"));return}
    requested=true;
    openingTimer=setTimeout(()=>{requestClose();notify(t("noResponse"));},7000);
    const types = Object.keys(family);
    send("open",{
      mounts:types.filter(key=>typeof family[key]?.equip==="function"),
      summons:types.filter(key=>typeof family[key]?.mount==="function"&&typeof family[key]?.isEquipped==="function")
    });
  }
  for(const event of ["reset","status","rows","remove","action-done","error"]){
    Events.on(prefix+event,raw=>{if(requested)deliver(event,parse(raw));});
  }
  Events.on(prefix+"open-request",open);
  Events.on("hmp-inventory:open",open);
  Events.on("hmp-inventory:close",()=>{if(requested||visible)requestClose()});
  Events.on(prefix+"show",()=>{showPending=true;show()});
  Events.on(prefix+"close",hide);
  Events.on(prefix+"select-mount",raw=>{
    if(!visible)return;
    const data=parse(raw);
    const mount=family[data?.family];
    try{
      if(typeof mount?.equip!=="function"||mount.equip(data.itemId)!==true)throw Error();
    }catch{
      deliver("error",{message:t("mountSelect")});
    }
  });
  Events.on(prefix+"use-mount",raw=>{
    if(!visible)return;
    const data=parse(raw);
    const mount=family[data?.family];
    if(typeof mount?.mount!=="function"){
      deliver("error",{message:t("broomUnsupported")});
      return;
    }
    if(data.select){
      try{
        if(typeof mount.equip!=="function"||mount.equip(data.itemId)!==true)throw Error();
      }catch{
        deliver("error",{message:t("mountSelect")});
        return;
      }
    }
    requestClose();
    setTimeout(()=>summon(mount),data.select?350:0);
  });
  function summon(mount){
    if(visible||requested)return;
    try{
      if(typeof mount?.mount!=="function"){
        notify(t("summonUnavailable"));return;
      }
      if(mount.mounted?.()||mount.summoning?.())return;
      if(mount.isEquipped?.()===false){notify(t("chooseMount"));return}
      if(mount.canMount?.()===false||!mount.mount())notify(t("cannotMount"));
    }catch{notify(t("summonUnavailable"));}
  }
  const assigned=new Set();
  for(const [action,handler] of [["inventory",open],...Object.keys(family).map(key=>[key,()=>summon(family[key])])]){
    const key=String(config[action]||"").trim().toLowerCase();
    if(!key)continue;
    if(assigned.has(key)){console.warn("[kairo-inventory] Tasto duplicato ignorato: "+key);continue}
    try{Key.bind(key,handler);assigned.add(key)}
    catch{console.warn("[kairo-inventory] Tasto non disponibile: "+key);}
  }
  Events.on("resourceStop",name=>{
    if(name&&name!=="hmp-inventory")return;
    try{hide()}finally{if(view>=0)Web.destroyView(view)}
  });
  prepare();
  console.info("[kairo-inventory] Client pronto");
})();
