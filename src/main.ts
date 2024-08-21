import { bootstrapApplication } from '@angular/platform-browser';
import { provideServiceWorker } from '@angular/service-worker';
import { isDevMode, LOCALE_ID } from '@angular/core';
import { AppComponent } from './app/app.component';

import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
registerLocaleData(localeFr);

bootstrapApplication(AppComponent, { providers: [
    provideServiceWorker('ngsw-worker.js', /*{ enabled: !isDevMode() }*/),
    //{ provide: LOCALE_ID, useValue: 'fr' },
] }).catch((err) => console.error(err));
