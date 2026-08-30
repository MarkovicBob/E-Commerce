import { DatePipe } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { BlogPost } from '../../core/models';
import { BlogService } from '../../core/services/blog.service';
import { LanguageService } from '../../core/services/language.service';
import { EmptyStateComponent, PaginationComponent, SkeletonLoaderComponent } from '../../shared/ui.component';

@Component({
  standalone: true,
  imports: [RouterLink, TranslateModule, DatePipe, PaginationComponent, SkeletonLoaderComponent, EmptyStateComponent],
  template: `
    <div class="section-y">
      <h1 class="font-serif text-4xl">{{ 'blog.title' | translate }}</h1>
      <p class="mt-2 max-w-2xl text-charcoal/60">{{ 'blog.lead' | translate }}</p>

      <div class="mt-6 flex flex-wrap gap-2">
        <button type="button" class="chip" [class.chip-active]="!category()" (click)="filter(null)">
          {{ 'blog.all' | translate }}
        </button>
        @for (item of categories(); track item.value) {
          <button
            type="button"
            class="chip"
            [class.chip-active]="category() === item.value"
            (click)="filter(item.value)"
          >
            {{ label(item.value) | translate }}
            <span class="text-charcoal/40">{{ item.count }}</span>
          </button>
        }
      </div>

      @if (loading()) {
        <div class="mt-10 grid gap-8 md:grid-cols-3">
          @for (item of skeletons; track item) {
            <app-skeleton-loader [height]="200" [lines]="3" />
          }
        </div>
      } @else if (posts().length === 0) {
        <app-empty-state class="mt-10 block" [title]="'blog.noPosts' | translate" />
      } @else {
        <div class="mt-10 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          @for (post of posts(); track post.id) {
            <article class="fade-in group flex flex-col overflow-hidden rounded-lg bg-white">
              <a [routerLink]="['/blog', post.slug]" class="block overflow-hidden">
                <img
                  class="aspect-video w-full object-cover transition duration-500 group-hover:scale-105"
                  [src]="post.cover_image_url"
                  [alt]="post.title"
                  loading="lazy"
                />
              </a>
              <div class="flex flex-1 flex-col p-5">
                <p class="text-xs uppercase tracking-wide text-gold">{{ label(post.category) | translate }}</p>
                <h2 class="mt-2 font-serif text-2xl leading-snug">
                  <a class="hover:text-gold" [routerLink]="['/blog', post.slug]">{{ post.title }}</a>
                </h2>
                <p class="mt-2 flex-1 text-sm leading-6 text-charcoal/65">{{ post.excerpt }}</p>
                <div class="mt-4 flex items-center justify-between text-xs text-charcoal/45">
                  <span>{{ post.published_at | date: 'mediumDate' }}</span>
                  <a class="font-semibold text-gold hover:underline" [routerLink]="['/blog', post.slug]">
                    {{ 'blog.readMore' | translate }} →
                  </a>
                </div>
              </div>
            </article>
          }
        </div>
        <app-pagination [page]="page()" [pages]="pages()" (changed)="goToPage($event)" />
      }
    </div>
  `
})
export class BlogListPage {
  private readonly blog = inject(BlogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly language = inject(LanguageService);

  readonly posts = signal<BlogPost[]>([]);
  readonly categories = signal<{ value: string; count: number }[]>([]);
  readonly category = signal<string | null>(null);
  readonly page = signal(1);
  readonly pages = signal(1);
  readonly loading = signal(true);
  readonly skeletons = [1, 2, 3];
  /** Non-reactive record of the language the current results were fetched in. */
  private lastLang: string | null = null;

  constructor() {
    this.blog.categories().subscribe({ next: (items) => this.categories.set(items), error: () => undefined });
    this.route.queryParamMap.subscribe((params) => {
      this.category.set(params.get('category'));
      this.page.set(Number(params.get('page') ?? 1) || 1);
      this.load();
    });
    // Posts are translated server-side; reload when the language actually changes.
    // The query-param subscription above already covers the first paint.
    effect(
      () => {
        const lang = this.language.lang();
        if (this.lastLang !== null && this.lastLang !== lang) {
          this.blog.categories().subscribe({ next: (items) => this.categories.set(items), error: () => undefined });
          this.load();
        }
        this.lastLang = lang;
      },
      { allowSignalWrites: true }
    );
  }

  /** Falls back to the raw slug when a category has no translation entry yet. */
  label(value: string) {
    return `blog.category.${value}`;
  }

  private load() {
    this.loading.set(true);
    this.blog.list(this.category() ?? undefined, this.page()).subscribe({
      next: (page) => {
        this.posts.set(page.items);
        this.pages.set(page.pages);
        this.loading.set(false);
      },
      error: () => {
        this.posts.set([]);
        this.loading.set(false);
      }
    });
  }

  filter(category: string | null) {
    this.router.navigate([], { relativeTo: this.route, queryParams: { category, page: null } });
  }

  goToPage(page: number) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: page === 1 ? null : page },
      queryParamsHandling: 'merge'
    });
  }
}
