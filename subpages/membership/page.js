'use strict';
const client = require('../../utils/membership-ui-client');
const {takeReminder} = require('../../utils/membership-reminders');
const {captureAccountSession,isAccountSessionCurrent} = require('../../utils/account-session');
function makePage(kind) {
  return {
    data:{loading:true,error:false,model:null,orders:[],detail:null,selectedId:'',submitting:false,paying:false,localPending:false,message:'',nextOffset:null,loadingMore:false,selectedQuestion:'',reminderText:''},
    onLoad(options) { this._orderId=options?.id || '';this._sequence=0;this._visible=false; },
    onShow() {
      this._visible=true;
      if (!this._network) {this._network = state=>{if(state.isConnected && this._visible && !this.data.submitting && !this.data.paying)this.reload();};wx.onNetworkStatusChange(this._network);}
      this.reload();
    },
    onHide() {this._visible=false;this._sequence++;clearTimeout(this._timer);},
    onUnload() {this.onHide();if(this._network)wx.offNetworkStatusChange(this._network);},
    async reload() {
      clearTimeout(this._timer);
      const seq=++this._sequence,session=captureAccountSession();
      const current=()=>this._visible && seq===this._sequence && isAccountSessionCurrent(session);
      if (this._session && !isAccountSessionCurrent(this._session)) {
        this._retainRequest=null;this._purchaseRequest=null;
        this.setData({selectedId:'',localPending:false,message:'',submitting:false,paying:false,loadingMore:false});
      }
      this._session=session;
      this.setData({loading:true,error:false,model:null,detail:null,orders:[],nextOffset:null,reminderText:''});
      try {
        if (kind === 'orders') {
          const result=await client.call('getOrders');if(!current())return;
          if(!Array.isArray(result.orders))throw Error('INVALID_RESPONSE');
          this.setData({orders:result.orders,nextOffset:result.nextOffset,loading:false});
          if(result.orders.some(o=>o.pending))this.poll();
        } else if (kind === 'order-detail') {
          const result=await client.call('getOrderDetail',{orderId:this._orderId});if(!current())return;
          if(!result.orderDetail)throw Error('INVALID_RESPONSE');
          this.setData({detail:result.orderDetail,loading:false});if(result.orderDetail.pending)this.poll();
        } else if (['rules','support'].includes(kind)) {
          const model=await client.call('getPublicConfig');if(!current())return;
          this.setData({model,loading:false});
        } else {
          const model=await client.getDisplay();if(!current())return;
          const selectedId=model.retentionStudents.some(s=>s.id===this.data.selectedId) ? this.data.selectedId : '';
          this.setData({model,loading:false,selectedId,localPending:model.pending,
            reminderText:kind === 'index' && !model.pending ? takeReminder(model,wx) : ''});
          if(model.pending)this.poll();
        }
      } catch {
        if(current())this.setData({loading:false,error:true,model:null,detail:null,orders:[]});
      }
    },
    poll() {if(this._visible)this._timer=setTimeout(()=>this.reload(),8000);},
    async moreOrders() {
      if(this.data.loadingMore || this.data.nextOffset===null || this.data.error)return;
      const session=captureAccountSession(),seq=this._sequence;
      this.setData({loadingMore:true});
      try {const result=await client.call('getOrders',{offset:this.data.nextOffset});
        if(this._visible && seq===this._sequence && isAccountSessionCurrent(session))this.setData({orders:this.data.orders.concat(result.orders),nextOffset:result.nextOffset});
      } catch {if(this._visible && isAccountSessionCurrent(session))this.setData({message:'订单暂时无法获取，请重试'});}
      finally {if(this._visible && isAccountSessionCurrent(session))this.setData({loadingMore:false});}
    },
    openOrder(event) {wx.navigateTo({url:'/subpages/membership/order-detail?id='+encodeURIComponent(event.currentTarget.dataset.id)});},
    chooseStudent(event) {
      if(this.data.loading || this.data.error || this.data.submitting || !this.data.model?.retentionAllowed)return;
      const value=event.detail.value;
      if(this.data.model.retentionStudents.some(s=>s.id===value)){if(value!==this.data.selectedId)this._retainRequest=null;this.setData({selectedId:value,message:''});}
    },
    async confirmRetention() {
      if(this.data.loading || this.data.error || this.data.submitting || !this.data.selectedId || !this.data.model?.retentionAllowed)return;
      const session=captureAccountSession();this._retainRequest ||= client.requestId();
      this.setData({submitting:true,message:''});
      try {await client.retain(this.data.selectedId,this._retainRequest);if(!isAccountSessionCurrent(session))return;
        this.setData({message:'已确认保留学生'});if(this._visible)await this.reload();
      } catch {if(isAccountSessionCurrent(session))this.setData({error:true,model:null,message:'保留结果暂时无法确认，请重新加载后重试'});}
      finally {if(isAccountSessionCurrent(session))this.setData({submitting:false});}
    },
    async buy() {
      const m=this.data.model;
      if(this.data.loading || this.data.error || this.data.paying || this.data.localPending || !m || m.pending || !m.showPurchase)return;
      if(!(m.canPurchase || m.canRenew)){this.setData({message:'会员购买暂未开放'});return;}
      const session=captureAccountSession();this._purchaseRequest ||= client.requestId();
      this.setData({paying:true,localPending:true,message:'正在确认支付结果'});
      try {const result=await client.purchase(this._purchaseRequest);if(!isAccountSessionCurrent(session))return;
        this.setData({message:result.status==='prepared'?'订单已准备，会员购买暂未开放':result.status==='cancelled'?'已取消支付':result.status==='unsupported'?'当前设备暂不支持购买':'正在确认支付结果'});
      } catch {if(isAccountSessionCurrent(session))this.setData({message:'购买暂不可用，请重新加载会员信息'});}
      finally {if(isAccountSessionCurrent(session)){this.setData({paying:false});if(this._visible)await this.reload();}}
    },
    chooseQuestion(event) {this.setData({selectedQuestion:event.currentTarget.dataset.question});},
    contact() {
      if(this.data.error || this.data.loading || !this.data.model?.supportAvailable)return;
      const support=this.data.model.support;if(support?.type==='phone')wx.makePhoneCall({phoneNumber:support.value});
    }
  };
}
module.exports={makePage};
