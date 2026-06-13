import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BlogPost, BlogService } from '../../core/services/blog.service';

@Component({ standalone: true, imports: [RouterLink], template: `<section class="section"><h1 class="font-serif text-4xl">Journal</h1><div class="mt-8 grid gap-6 md:grid-cols-3">@for (post of posts(); track post.id) { <a [routerLink]="['/blog', post.slug]" class="rounded bg-white p-5"><img class="aspect-video w-full rounded object-cover" [src]="post.cover_image_url"><h2 class="mt-4 font-serif text-2xl">{{ post.title }}</h2><p class="mt-2 text-sm text-charcoal/70">{{ post.excerpt }}</p></a> }</div></section>` })
export class BlogListPage { private readonly blog = inject(BlogService); readonly posts = signal<BlogPost[]>([]); constructor() { this.blog.list().subscribe((page) => this.posts.set(page.items)); } }
