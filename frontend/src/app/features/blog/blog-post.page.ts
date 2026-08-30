import { DatePipe } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { BlogPost } from '../../core/models';
import { BlogService } from '../../core/services/blog.service';
import { LanguageService } from '../../core/services/language.service';
import { EmptyStateComponent, SkeletonLoaderComponent } from '../../shared/ui.component';

@Component({
  standalone: true,
  imports: [RouterLink, TranslateModule, DatePipe, SkeletonLoaderComponent, EmptyStateComponent],
  template: `
    @if (loading()) {
      <div class="section-y max-w-3xl"><app-skeleton-loader [height]="320" [lines]="6" /></div>
    } @else {
      @if (post(); as p) {
      <article class="section-y max-w-3xl">
        <a class="text-sm text-gold hover:underline" routerLink="/blog">← {{ 'blog.back' | translate }}</a>
        <p class="mt-6 text-xs uppercase tracking-[0.2em] text-gold">{{ 'blog.category.' + p.category | translate }}</p>
        <h1 class="mt-3 font-serif text-4xl leading-tight sm:text-5xl">{{ p.title }}</h1>
        <p class="mt-3 text-sm text-charcoal/50">{{ p.published_at | date: 'longDate' }}</p>

        @if (p.cover_image_url) {
          <img class="mt-8 aspect-video w-full rounded-lg object-cover" [src]="p.cover_image_url" [alt]="p.title" />
        }

        <p class="mt-8 text-lg leading-8 text-charcoal/75">{{ p.excerpt }}</p>
        <div class="prose-content mt-6" [innerHTML]="p.content"></div>
      </article>

      @if ((p.related ?? []).length) {
        <section class="section-y border-t border-charcoal/10">
          <h2 class="font-serif text-3xl">{{ 'blog.related' | translate }}</h2>
          <div class="mt-6 grid gap-6 md:grid-cols-3">
            @for (item of p.related ?? []; track item.id) {
              <a class="group block overflow-hidden rounded-lg bg-white" [routerLink]="['/blog', item.slug]">
                <img
                  class="aspect-video w-full object-cover transition duration-500 group-hover:scale-105"
                  [src]="item.cover_image_url"
                  [alt]="item.title"
                  loading="lazy"
                />
                <div class="p-4">
                  <h3 class="font-serif text-xl leading-snug group-hover:text-gold">{{ item.title }}</h3>
                  <p class="mt-2 text-sm text-charcoal/60">{{ item.excerpt }}</p>
                </div>
              </a>
            }
          </div>
        </section>
      }
      } @else {
        <div class="section-y">
          <app-empty-state [title]="'blog.noPosts' | translate">
            <a class="btn-primary" routerLink="/blog">{{ 'blog.back' | translate }}</a>
          </app-empty-state>
        </div>
      }
    }
  `
})
export class BlogPostPage {
  private readonly route = inject(ActivatedRoute);
  private readonly blog = inject(BlogService);
  private readonly language = inject(LanguageService);

  readonly post = signal<BlogPost | null>(null);
  readonly loading = signal(true);
  /** Non-reactive: the slug currently on screen, used by the language effect. */
  private loadedSlug: string | null = null;

  constructor() {
    // `loadedSlug` is a plain field: reading the post signal here would make the
    // effect re-run on every fetch it triggers.
    effect(
      () => {
        this.language.lang();
        if (this.loadedSlug) this.fetch(this.loadedSlug);
      },
      { allowSignalWrites: true }
    );
    this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug');
      if (slug) this.fetch(slug);
    });
  }

  private fetch(slug: string) {
    {
      this.loadedSlug = slug;
      this.loading.set(true);
      this.blog.detail(slug).subscribe({
        next: (post) => {
          // Bound through [innerHTML], so Angular's sanitiser strips scripts from
          // admin-authored post bodies. Never bypass it here.
          this.post.set(post);
          this.loading.set(false);
        },
        error: () => {
          this.post.set(null);
          this.loading.set(false);
        }
      });
    }
  }
}
