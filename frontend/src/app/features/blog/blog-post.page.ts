import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { BlogPost, BlogService } from '../../core/services/blog.service';

@Component({ standalone: true, template: `@if (post(); as p) { <article class="section max-w-3xl"><img class="aspect-video w-full rounded object-cover" [src]="p.cover_image_url"><h1 class="mt-8 font-serif text-5xl">{{ p.title }}</h1><p class="mt-4 text-charcoal/70">{{ p.excerpt }}</p><div class="prose mt-8" [innerHTML]="p.content"></div></article> }` })
export class BlogPostPage { private readonly route = inject(ActivatedRoute); private readonly blog = inject(BlogService); readonly post = signal<BlogPost | null>(null); constructor() { this.route.paramMap.subscribe((p) => this.blog.detail(p.get('slug')!).subscribe((post) => this.post.set(post))); } }
