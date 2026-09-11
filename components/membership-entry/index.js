'use strict';
const client=require('../../utils/membership-ui-client');
const {captureAccountSession,isAccountSessionCurrent}=require('../../utils/account-session');
Component({
  data:{subtitle:'正在加载',attention:false},
  lifetimes:{attached(){this._visible=true;this.refresh();},detached(){this._visible=false;this._sequence++;if(this._network)wx.offNetworkStatusChange(this._network);}},
  pageLifetimes:{show(){this._visible=true;this.refresh();},hide(){this._visible=false;this._sequence++;}},
  methods:{async refresh(){
    if(!this._network){this._network=s=>{if(s.isConnected&&this._visible)this.refresh();};wx.onNetworkStatusChange(this._network);}
    const seq=this._sequence=(this._sequence||0)+1,session=captureAccountSession();
    this.setData({subtitle:'正在加载',attention:false});
    try {const model=await client.getDisplay();if(this._visible&&seq===this._sequence&&isAccountSessionCurrent(session))this.setData({subtitle:model.entrySubtitle,attention:model.attention});}
    catch {if(this._visible&&seq===this._sequence&&isAccountSessionCurrent(session))this.setData({subtitle:'会员信息暂时无法获取',attention:false});}
  }}
});
