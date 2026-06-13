import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { HeaderComponent } from './shared/header.component';
import { FooterComponent } from './shared/footer.component';
import { ToastComponent } from './shared/toast.component';
import { LanguageService } from './core/services/language.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, TranslateModule, HeaderComponent, FooterComponent, ToastComponent],
  template: `
    <app-header />
    <main class="min-h-screen"><router-outlet /></main>
    <app-footer />
    <app-toast />
  `
})
export class AppComponent {
  private readonly language = inject(LanguageService);
  constructor() {
    this.language.init();
  }
}
