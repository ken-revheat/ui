import {describe,it,expect,vi,beforeEach,afterEach} from 'vitest';
import {mount} from '@vue/test-utils';
import {AppShell} from '../src/vue';
import * as core from '../src/core';

const workspace={homeHref:'https://callanalyzer.revheat.com/app/deals',screens:[
  {id:'deals',label:'Deals',href:'https://callanalyzer.revheat.com/app/deals'},
  {id:'team',label:'Team',href:'https://callanalyzer.revheat.com/app/dashboard',match:['https://callanalyzer.revheat.com/app/team','https://callanalyzer.revheat.com/app/brief']},
  {id:'playbook',label:'Playbook',href:'https://app.revheat.com/playbook'}],
  advisor:{id:'advisor',label:'Ask RevHeat',href:'https://coach.revheat.com/app'},tools:[],
  settingsHref:'https://callanalyzer.revheat.com/app/settings',personalHref:'https://callanalyzer.revheat.com/app/home',playbookSettingsHref:'https://app.revheat.com/settings/playbook'};
beforeEach(()=>{window.matchMedia=vi.fn().mockReturnValue({matches:false,addEventListener(){},removeEventListener(){}})});
afterEach(()=>{document.body.innerHTML=''});
describe('one platform workspace',()=>{
  it('replaces the product directory with the enabled workspace and Advisor',()=>{
    const wrapper=mount(AppShell,{props:{identity:{email:'manager@example.test',isInternal:false,roleLabel:'Manager'},products:[],activePath:'/playbook',appearance:'ledger',workspace,screens:core.workspaceScreens(workspace,'https://app.revheat.com/playbook')} as any});
    expect(wrapper.text()).toContain('Ask RevHeat');
    expect(wrapper.text()).toContain('Platform');
    expect(wrapper.find('.rh-menu a[aria-current="page"]').text()).toBe('Playbook');
    expect(wrapper.text()).not.toContain('All products');
    expect(wrapper.text()).not.toContain('Portal');
    expect(wrapper.text()).not.toContain('Tools');
    expect(wrapper.find('a[aria-label="RevHeat home"]').attributes('href')).toBe(workspace.homeHref);
    wrapper.unmount();
  });
  it('supports relative links without making a root screen active on every page',()=>{
    const configured={...workspace,screens:[{id:'root',label:'Home',href:'/'},{id:'playbook',label:'Playbook',href:'/playbook'}]};
    expect(core.workspaceScreens(configured,'https://app.revheat.com/playbook').filter(s=>s.active).map(s=>s.label)).toEqual(['Playbook']);
    expect(core.workspaceScreens(configured,'https://app.revheat.com/').filter(s=>s.active).map(s=>s.label)).toEqual(['Home']);
    expect(core.workspaceScreens({...workspace,screens:[{id:'invalid',label:'Invalid',href:'https://['}]},'https://app.revheat.com/')[0].active).toBe(false);
  });
  it('matches a destination by origin as well as path, including nested Team reports',()=>{
    const resolve=(core as any).workspaceScreens;
    expect(resolve).toBeTypeOf('function');
    expect(resolve(workspace,'https://callanalyzer.revheat.com/app/brief').filter((s:any)=>s.active).map((s:any)=>s.label)).toEqual(['Team']);
    expect(resolve(workspace,'https://coach.revheat.com/app/brief').filter((s:any)=>s.active)).toEqual([]);
    expect(resolve(workspace,'https://app.revheat.com/playbook?view=changes').find((s:any)=>s.label==='Playbook').active).toBe(true);
  });
});
