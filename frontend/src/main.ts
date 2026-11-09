import {bootstrapApplication} from '@angular/platform-browser';
import {provideRouter,Routes} from '@angular/router';
import {Component,inject,ApplicationRef} from '@angular/core';
import {AppComponent} from './app';
@Component({standalone:true,template:''}) class RoutePage {}
const routes:Routes=[{path:'',component:RoutePage},{path:'tournaments',component:RoutePage},{path:'tournaments/:id',component:RoutePage},{path:'calendar',component:RoutePage},{path:'matches/:id',component:RoutePage},{path:'teams',component:RoutePage},{path:'teams/:id',component:RoutePage},{path:'players',component:RoutePage},{path:'players/:id',component:RoutePage},{path:'news',component:RoutePage},{path:'news/:id',component:RoutePage},{path:'regulations',component:RoutePage},{path:'office',component:RoutePage},{path:'office/:section',component:RoutePage},{path:'office/protocol/:id',component:RoutePage},{path:'**',component:RoutePage}];
const leave=()=>{const app=inject(ApplicationRef).components[0]?.instance as AppComponent;if(app?.dirty){if(!confirm('Есть несохранённые изменения протокола. Покинуть страницу?'))return false;app.dirty=false;}return true;};
bootstrapApplication(AppComponent,{providers:[provideRouter(routes.map(r=>({...r,canDeactivate:[leave]})))]}).catch(console.error);
