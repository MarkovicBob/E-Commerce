import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  AdminStats,
  AdminUser,
  BlogPost,
  Category,
  Order,
  OrderStatus,
  Product,
  ProductImage,
  PromoCode,
  Review,
  Role,
  Variant
} from '../../core/models';
import { AdminService, VariantInput } from '../../core/services/admin.service';
import { LanguageService } from '../../core/services/language.service';
import { ToastService } from '../../core/services/toast.service';
import { PricePipe } from '../../shared/price.pipe';
import { ConfirmDialogComponent, EmptyStateComponent, PaginationComponent } from '../../shared/ui.component';

type Tab = 'dashboard' | 'products' | 'categories' | 'orders' | 'users' | 'reviews' | 'blog' | 'promo';

interface PendingDelete {
  kind: 'product' | 'category' | 'review' | 'promo' | 'blog';
  id: number;
  label: string;
}

const ORDER_STATUSES: OrderStatus[] = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

@Component({
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslateModule,
    DatePipe,
    PricePipe,
    PaginationComponent,
    ConfirmDialogComponent,
    EmptyStateComponent
  ],
  template: `
    <div class="section-y">
      <h1 class="font-serif text-4xl">{{ 'admin.title' | translate }}</h1>

      <div class="mt-6 flex gap-1 overflow-x-auto border-b border-charcoal/15" role="tablist">
        @for (item of tabs; track item) {
          <button
            type="button"
            role="tab"
            class="tab"
            [class.tab-active]="tab() === item"
            [attr.aria-selected]="tab() === item"
            (click)="setTab(item)"
          >
            {{ tabLabel(item) | translate }}
          </button>
        }
      </div>

      <div class="py-8">
        @switch (tab()) {
          @case ('dashboard') {
            @if (stats(); as s) {
              <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                @for (card of statCards(); track card.label) {
                  <div class="card">
                    <p class="text-xs uppercase tracking-wide text-charcoal/50">{{ card.label | translate }}</p>
                    <p class="mt-2 font-serif text-3xl">
                      @if (card.currency) { {{ card.value | price }} } @else { {{ card.value }} }
                    </p>
                  </div>
                }
              </div>

              <div class="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
                <div class="card">
                  <h2 class="font-serif text-2xl">{{ 'admin.revenueChart' | translate }}</h2>
                  <div class="mt-6 flex h-52 items-end gap-[2px]" role="img" [attr.aria-label]="'admin.revenueChart' | translate">
                    @for (point of s.revenue_series; track point.date) {
                      <div
                        class="flex-1 rounded-t bg-gold/70 transition hover:bg-gold"
                        [style.height.%]="barHeight(point.revenue)"
                        [title]="point.date + ': ' + point.revenue"
                      ></div>
                    }
                  </div>
                  <div class="mt-2 flex justify-between text-xs text-charcoal/45">
                    <span>{{ seriesStart() }}</span>
                    <span>{{ seriesEnd() }}</span>
                  </div>
                </div>

                <div class="card">
                  <h2 class="font-serif text-2xl">{{ 'admin.ordersByStatus' | translate }}</h2>
                  <ul class="mt-4 space-y-2 text-sm">
                    @for (status of orderStatuses; track status) {
                      <li class="flex items-center justify-between">
                        <span class="text-charcoal/65">{{ 'status.' + status | translate }}</span>
                        <span class="font-semibold">{{ s.orders_by_status[status] }}</span>
                      </li>
                    }
                  </ul>
                </div>
              </div>

              <div class="mt-6 grid gap-6 lg:grid-cols-2">
                <div class="card">
                  <h2 class="font-serif text-2xl">{{ 'admin.topProducts' | translate }}</h2>
                  <ul class="mt-4 space-y-2 text-sm">
                    @for (item of s.top_products; track item.name) {
                      <li class="flex items-center justify-between gap-3">
                        <span class="truncate text-charcoal/75">{{ item.name }}</span>
                        <span class="shrink-0 font-semibold">{{ item.quantity }} · {{ item.revenue | price }}</span>
                      </li>
                    } @empty {
                      <li class="text-charcoal/50">{{ 'admin.noResults' | translate }}</li>
                    }
                  </ul>
                </div>

                <div class="card">
                  <h2 class="font-serif text-2xl">{{ 'admin.lowStock' | translate }}</h2>
                  <ul class="mt-4 space-y-2 text-sm">
                    @for (item of s.low_stock; track item.id) {
                      <li class="flex items-center justify-between gap-3">
                        <span class="truncate text-charcoal/75">{{ item.name }}</span>
                        <span class="shrink-0 font-semibold" [class.text-red-700]="item.stock_quantity === 0">
                          {{ item.stock_quantity }}
                        </span>
                      </li>
                    } @empty {
                      <li class="text-charcoal/50">{{ 'admin.noResults' | translate }}</li>
                    }
                  </ul>
                </div>
              </div>
            }
          }

          @case ('products') {
            <div class="flex flex-wrap items-center justify-between gap-3">
              <input
                class="field max-w-xs"
                type="search"
                [placeholder]="'admin.search' | translate"
                [value]="productSearch()"
                (input)="searchProducts($any($event.target).value)"
              />
              <button type="button" class="btn-primary" (click)="newProduct()">{{ 'admin.create' | translate }}</button>
            </div>

            @if (editingProduct()) {
              <form class="card mt-6 grid gap-4 sm:grid-cols-2" [formGroup]="productForm" (ngSubmit)="saveProduct()">
                <label>
                  <span class="label-text">{{ 'admin.product.name' | translate }}</span>
                  <input class="field mt-1" formControlName="name" (input)="autoSlug()" />
                </label>
                <label>
                  <span class="label-text">{{ 'admin.product.slug' | translate }}</span>
                  <input class="field mt-1" formControlName="slug" />
                </label>
                <label>
                  <span class="label-text">{{ 'admin.product.price' | translate }}</span>
                  <input class="field mt-1" type="number" min="0" formControlName="price" />
                </label>
                <label>
                  <span class="label-text">{{ 'admin.product.discountPrice' | translate }}</span>
                  <input class="field mt-1" type="number" min="0" formControlName="discount_price" />
                </label>
                <label>
                  <span class="label-text">{{ 'admin.product.category' | translate }}</span>
                  <select class="field mt-1" formControlName="category_id">
                    @for (category of categories(); track category.id) {
                      <option [value]="category.id">{{ category.name }}</option>
                    }
                  </select>
                </label>
                <label>
                  <span class="label-text">{{ 'admin.product.brand' | translate }}</span>
                  <input class="field mt-1" formControlName="brand" />
                </label>
                <label>
                  <span class="label-text">{{ 'admin.product.stock' | translate }}</span>
                  <input class="field mt-1" type="number" min="0" formControlName="stock_quantity" />
                </label>
                <label>
                  <span class="label-text">{{ 'admin.product.status' | translate }}</span>
                  <select class="field mt-1" formControlName="status">
                    <option value="active">{{ 'status.active' | translate }}</option>
                    <option value="inactive">{{ 'status.inactive' | translate }}</option>
                  </select>
                </label>
                <label class="sm:col-span-2">
                  <span class="label-text">{{ 'admin.product.description' | translate }}</span>
                  <textarea class="field mt-1" rows="3" formControlName="description"></textarea>
                </label>
                <label class="flex items-center gap-2 text-sm">
                  <input type="checkbox" class="accent-gold" formControlName="is_featured" />
                  {{ 'admin.product.featured' | translate }}
                </label>
                <div class="flex gap-2 sm:col-span-2">
                  <button class="btn-primary" type="submit" [disabled]="productForm.invalid">
                    {{ 'admin.save' | translate }}
                  </button>
                  <button type="button" class="btn-secondary" (click)="editingProduct.set(false)">
                    {{ 'admin.cancel' | translate }}
                  </button>
                </div>
              </form>

              @if (editingProductId(); as productId) {
                <div class="card mt-4">
                  <h3 class="font-serif text-xl">{{ 'admin.images' | translate }}</h3>
                  <div class="mt-4 flex flex-wrap gap-3">
                    @for (image of editingImages(); track image.id) {
                      <figure class="relative">
                        <img class="h-28 w-24 rounded object-cover" [src]="image.image_url" [alt]="''" />
                        <button
                          type="button"
                          class="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-white/90 text-xs shadow hover:text-red-700"
                          [attr.aria-label]="'admin.delete' | translate"
                          (click)="removeImage(image)"
                        >
                          ✕
                        </button>
                      </figure>
                    } @empty {
                      <p class="text-sm text-charcoal/50">{{ 'admin.noImages' | translate }}</p>
                    }
                  </div>
                  <label class="mt-4 block">
                    <span class="label-text">{{ 'admin.uploadImage' | translate }}</span>
                    <input
                      class="field mt-1"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      (change)="uploadImage($event)"
                    />
                  </label>
                  <p class="mt-1 text-xs text-charcoal/45">{{ 'admin.uploadHint' | translate }}</p>
                  @if (uploadError(); as error) {
                    <p class="form-error">{{ error }}</p>
                  }
                </div>

                <div class="card mt-4">
                  <h3 class="font-serif text-xl">{{ 'admin.variants' | translate }}</h3>
                  <div class="mt-4 overflow-x-auto">
                    <table class="table-basic">
                      <thead>
                        <tr>
                          <th>{{ 'product.size' | translate }}</th>
                          <th>{{ 'product.color' | translate }}</th>
                          <th>{{ 'product.sku' | translate }}</th>
                          <th>{{ 'admin.product.stock' | translate }}</th>
                          <th>{{ 'admin.variantExtra' | translate }}</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (variant of editingVariants(); track variant.id) {
                          <tr>
                            <td>{{ variant.size || '—' }}</td>
                            <td>{{ variant.color || '—' }}</td>
                            <td class="font-mono text-xs">{{ variant.sku }}</td>
                            <td [class.text-red-700]="variant.stock_quantity === 0">{{ variant.stock_quantity }}</td>
                            <td>{{ variant.extra_price | price }}</td>
                            <td class="whitespace-nowrap text-right">
                              <button type="button" class="chip" (click)="editVariant(variant)">
                                {{ 'admin.edit' | translate }}
                              </button>
                              <button
                                type="button"
                                class="chip ml-1 hover:border-red-600 hover:text-red-700"
                                (click)="removeVariant(variant)"
                              >
                                {{ 'admin.delete' | translate }}
                              </button>
                            </td>
                          </tr>
                        } @empty {
                          <tr>
                            <td colspan="6" class="text-center text-charcoal/50">{{ 'admin.noVariants' | translate }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>

                  <form class="mt-4 grid gap-3 sm:grid-cols-5" [formGroup]="variantForm" (ngSubmit)="saveVariant()">
                    <label>
                      <span class="label-text">{{ 'product.size' | translate }}</span>
                      <input class="field mt-1" formControlName="size" />
                    </label>
                    <label>
                      <span class="label-text">{{ 'product.color' | translate }}</span>
                      <input class="field mt-1" formControlName="color" />
                    </label>
                    <label>
                      <span class="label-text">{{ 'product.sku' | translate }}</span>
                      <input class="field mt-1 font-mono" formControlName="sku" />
                    </label>
                    <label>
                      <span class="label-text">{{ 'admin.product.stock' | translate }}</span>
                      <input class="field mt-1" type="number" min="0" formControlName="stock_quantity" />
                    </label>
                    <label>
                      <span class="label-text">{{ 'admin.variantExtra' | translate }}</span>
                      <input class="field mt-1" type="number" min="0" formControlName="extra_price" />
                    </label>
                    <div class="flex gap-2 sm:col-span-5">
                      <button class="btn-primary" type="submit" [disabled]="variantForm.invalid">
                        {{ (editingVariantId() ? 'admin.save' : 'admin.create') | translate }}
                      </button>
                      @if (editingVariantId()) {
                        <button type="button" class="btn-secondary" (click)="resetVariantForm()">
                          {{ 'admin.cancel' | translate }}
                        </button>
                      }
                    </div>
                  </form>
                </div>
              } @else {
                <p class="mt-3 text-sm text-charcoal/55">{{ 'admin.saveFirst' | translate }}</p>
              }
            }

            <div class="mt-6 overflow-x-auto">
              <table class="table-basic">
                <thead>
                  <tr>
                    <th>{{ 'admin.product.name' | translate }}</th>
                    <th>{{ 'admin.product.brand' | translate }}</th>
                    <th>{{ 'admin.product.price' | translate }}</th>
                    <th>{{ 'admin.product.stock' | translate }}</th>
                    <th>{{ 'admin.product.status' | translate }}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (product of products(); track product.id) {
                    <tr>
                      <td>
                        <a class="hover:text-gold" [routerLink]="['/product', product.slug]">{{ product.name }}</a>
                      </td>
                      <td class="text-charcoal/60">{{ product.brand }}</td>
                      <td>{{ product.effective_price | price }}</td>
                      <td [class.text-red-700]="product.stock_quantity === 0">{{ product.stock_quantity }}</td>
                      <td>{{ 'status.' + product.status | translate }}</td>
                      <td class="whitespace-nowrap text-right">
                        <button type="button" class="chip" (click)="editProduct(product)">
                          {{ 'admin.edit' | translate }}
                        </button>
                        <button
                          type="button"
                          class="chip ml-1 hover:border-red-600 hover:text-red-700"
                          (click)="askDelete('product', product.id, product.name)"
                        >
                          {{ 'admin.delete' | translate }}
                        </button>
                      </td>
                    </tr>
                  } @empty {
                    <tr><td colspan="6" class="text-center text-charcoal/50">{{ 'admin.noResults' | translate }}</td></tr>
                  }
                </tbody>
              </table>
            </div>
            <app-pagination [page]="productPage()" [pages]="productPages()" (changed)="loadProducts($event)" />
          }

          @case ('categories') {
            <div class="flex justify-end">
              <button type="button" class="btn-primary" (click)="newCategory()">{{ 'admin.create' | translate }}</button>
            </div>

            @if (editingCategory()) {
              <form class="card mt-6 grid gap-4 sm:grid-cols-2" [formGroup]="categoryForm" (ngSubmit)="saveCategory()">
                <label>
                  <span class="label-text">{{ 'admin.product.name' | translate }}</span>
                  <input class="field mt-1" formControlName="name" />
                </label>
                <label>
                  <span class="label-text">{{ 'admin.product.slug' | translate }}</span>
                  <input class="field mt-1" formControlName="slug" />
                </label>
                <label>
                  <span class="label-text">{{ 'catalog.category' | translate }}</span>
                  <select class="field mt-1" formControlName="parent_category_id">
                    <option [value]="''">—</option>
                    @for (category of categories(); track category.id) {
                      <option [value]="category.id">{{ category.name }}</option>
                    }
                  </select>
                </label>
                <label>
                  <span class="label-text">{{ 'admin.blogForm.cover' | translate }}</span>
                  <input class="field mt-1" formControlName="image_url" />
                </label>
                <div class="flex gap-2 sm:col-span-2">
                  <button class="btn-primary" type="submit" [disabled]="categoryForm.invalid">
                    {{ 'admin.save' | translate }}
                  </button>
                  <button type="button" class="btn-secondary" (click)="editingCategory.set(false)">
                    {{ 'admin.cancel' | translate }}
                  </button>
                </div>
              </form>
            }

            <div class="mt-6 overflow-x-auto">
              <table class="table-basic">
                <thead>
                  <tr>
                    <th>{{ 'admin.product.name' | translate }}</th>
                    <th>{{ 'admin.product.slug' | translate }}</th>
                    <th>{{ 'catalog.category' | translate }}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (category of categories(); track category.id) {
                    <tr>
                      <td>{{ category.name }}</td>
                      <td class="font-mono text-xs text-charcoal/60">{{ category.slug }}</td>
                      <td class="text-charcoal/60">{{ parentName(category) }}</td>
                      <td class="whitespace-nowrap text-right">
                        <button type="button" class="chip" (click)="editCategory(category)">
                          {{ 'admin.edit' | translate }}
                        </button>
                        <button
                          type="button"
                          class="chip ml-1 hover:border-red-600 hover:text-red-700"
                          (click)="askDelete('category', category.id, category.name)"
                        >
                          {{ 'admin.delete' | translate }}
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }

          @case ('orders') {
            <div class="flex flex-wrap gap-3">
              <input
                class="field max-w-xs"
                type="search"
                [placeholder]="'admin.search' | translate"
                [value]="orderSearch()"
                (input)="searchOrders($any($event.target).value)"
              />
              <select class="field max-w-xs" [value]="orderStatus()" (change)="filterOrders($any($event.target).value)">
                <option value="">{{ 'admin.all' | translate }}</option>
                @for (status of orderStatuses; track status) {
                  <option [value]="status">{{ 'status.' + status | translate }}</option>
                }
              </select>
            </div>

            <div class="mt-6 overflow-x-auto">
              <table class="table-basic">
                <thead>
                  <tr>
                    <th>{{ 'account.orderNumber' | translate }}</th>
                    <th>{{ 'account.orderDate' | translate }}</th>
                    <th>{{ 'auth.email' | translate }}</th>
                    <th>{{ 'account.orderItems' | translate }}</th>
                    <th>{{ 'account.orderTotal' | translate }}</th>
                    <th>{{ 'account.orderStatus' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (order of orders(); track order.id) {
                    <tr>
                      <td class="font-mono text-xs">{{ order.order_number }}</td>
                      <td class="text-charcoal/60">{{ order.created_at | date: 'short' }}</td>
                      <td class="text-charcoal/60">{{ order.contact_email }}</td>
                      <td>{{ order.item_count }}</td>
                      <td class="font-semibold">{{ order.total | price }}</td>
                      <td>
                        <select
                          class="field w-36 py-1 text-xs"
                          [value]="order.status"
                          (change)="changeOrderStatus(order, $any($event.target).value)"
                        >
                          @for (status of orderStatuses; track status) {
                            <option [value]="status">{{ 'status.' + status | translate }}</option>
                          }
                        </select>
                      </td>
                    </tr>
                  } @empty {
                    <tr><td colspan="6" class="text-center text-charcoal/50">{{ 'admin.noResults' | translate }}</td></tr>
                  }
                </tbody>
              </table>
            </div>
            <app-pagination [page]="orderPage()" [pages]="orderPages()" (changed)="loadOrders($event)" />
          }

          @case ('users') {
            <input
              class="field max-w-xs"
              type="search"
              [placeholder]="'admin.search' | translate"
              [value]="userSearch()"
              (input)="searchUsers($any($event.target).value)"
            />

            <div class="mt-6 overflow-x-auto">
              <table class="table-basic">
                <thead>
                  <tr>
                    <th>{{ 'auth.fullName' | translate }}</th>
                    <th>{{ 'auth.email' | translate }}</th>
                    <th>{{ 'account.tabOrders' | translate }}</th>
                    <th>{{ 'account.orderTotal' | translate }}</th>
                    <th>{{ 'admin.role' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (user of users(); track user.id) {
                    <tr>
                      <td>{{ user.full_name }}</td>
                      <td class="text-charcoal/60">{{ user.email }}</td>
                      <td>{{ user.order_count }}</td>
                      <td>{{ user.total_spent | price }}</td>
                      <td>
                        <select
                          class="field w-36 py-1 text-xs"
                          [value]="user.role"
                          (change)="changeRole(user, $any($event.target).value)"
                        >
                          <option value="customer">{{ 'status.customer' | translate }}</option>
                          <option value="admin">{{ 'status.admin' | translate }}</option>
                        </select>
                      </td>
                    </tr>
                  } @empty {
                    <tr><td colspan="5" class="text-center text-charcoal/50">{{ 'admin.noResults' | translate }}</td></tr>
                  }
                </tbody>
              </table>
            </div>
            <app-pagination [page]="userPage()" [pages]="userPages()" (changed)="loadUsers($event)" />
          }

          @case ('reviews') {
            <div class="flex flex-wrap gap-2">
              @for (option of reviewFilters; track option.value) {
                <button
                  type="button"
                  class="chip"
                  [class.chip-active]="reviewFilter() === option.value"
                  (click)="filterReviews(option.value)"
                >
                  {{ option.label | translate }}
                </button>
              }
            </div>

            <div class="mt-6 space-y-3">
              @for (review of reviews(); track review.id) {
                <article class="card flex flex-wrap items-start justify-between gap-4">
                  <div class="min-w-0 flex-1">
                    <p class="font-semibold">
                      {{ review.product_name }}
                      <span class="ml-2 text-xs font-normal text-charcoal/50">{{ review.author }}</span>
                    </p>
                    <p class="mt-1 text-sm text-gold">{{ starsFor(review.rating) }}</p>
                    @if (review.comment) {
                      <p class="mt-2 text-sm text-charcoal/70">{{ review.comment }}</p>
                    }
                    <p class="mt-2 text-xs text-charcoal/45">
                      {{ review.created_at | date: 'short' }} ·
                      {{ (review.is_approved ? 'account.reviewApproved' : 'account.reviewPending') | translate }}
                    </p>
                  </div>
                  <div class="flex gap-2">
                    @if (!review.is_approved) {
                      <button type="button" class="chip" (click)="approveReview(review)">
                        {{ 'admin.approve' | translate }}
                      </button>
                    } @else {
                      <button type="button" class="chip" (click)="rejectReview(review)">
                        {{ 'admin.reject' | translate }}
                      </button>
                    }
                    <button
                      type="button"
                      class="chip hover:border-red-600 hover:text-red-700"
                      (click)="askDelete('review', review.id, review.product_name ?? '')"
                    >
                      {{ 'admin.delete' | translate }}
                    </button>
                  </div>
                </article>
              } @empty {
                <app-empty-state [title]="'admin.noResults' | translate" />
              }
            </div>
            <app-pagination [page]="reviewPage()" [pages]="reviewPages()" (changed)="loadReviews($event)" />
          }

          @case ('blog') {
            <div class="flex justify-end">
              <button type="button" class="btn-primary" (click)="newBlog()">{{ 'admin.create' | translate }}</button>
            </div>

            @if (editingBlog()) {
              <form class="card mt-6 grid gap-4 sm:grid-cols-2" [formGroup]="blogForm" (ngSubmit)="saveBlog()">
                <label>
                  <span class="label-text">{{ 'admin.blogForm.title' | translate }}</span>
                  <input class="field mt-1" formControlName="title" />
                </label>
                <label>
                  <span class="label-text">{{ 'admin.blogForm.slug' | translate }}</span>
                  <input class="field mt-1" formControlName="slug" />
                </label>
                <label>
                  <span class="label-text">{{ 'admin.blogForm.category' | translate }}</span>
                  <input class="field mt-1" formControlName="category" />
                </label>
                <label>
                  <span class="label-text">{{ 'admin.blogForm.cover' | translate }}</span>
                  <input class="field mt-1" formControlName="cover_image_url" />
                </label>
                <label class="sm:col-span-2">
                  <span class="label-text">{{ 'admin.blogForm.excerpt' | translate }}</span>
                  <textarea class="field mt-1" rows="2" formControlName="excerpt"></textarea>
                </label>
                <label class="sm:col-span-2">
                  <span class="label-text">{{ 'admin.blogForm.content' | translate }}</span>
                  <textarea class="field mt-1 font-mono text-xs" rows="8" formControlName="content"></textarea>
                </label>
                <label class="flex items-center gap-2 text-sm">
                  <input type="checkbox" class="accent-gold" formControlName="is_published" />
                  {{ 'admin.blogForm.published' | translate }}
                </label>
                <div class="flex gap-2 sm:col-span-2">
                  <button class="btn-primary" type="submit" [disabled]="blogForm.invalid">
                    {{ 'admin.save' | translate }}
                  </button>
                  <button type="button" class="btn-secondary" (click)="editingBlog.set(false)">
                    {{ 'admin.cancel' | translate }}
                  </button>
                </div>
              </form>
            }

            <div class="mt-6 overflow-x-auto">
              <table class="table-basic">
                <thead>
                  <tr>
                    <th>{{ 'admin.blogForm.title' | translate }}</th>
                    <th>{{ 'admin.blogForm.category' | translate }}</th>
                    <th>{{ 'admin.blogForm.published' | translate }}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (post of blogPosts(); track post.id) {
                    <tr>
                      <td>{{ post.title }}</td>
                      <td class="text-charcoal/60">{{ post.category }}</td>
                      <td>{{ (post.is_published ? 'common.yes' : 'common.no') | translate }}</td>
                      <td class="whitespace-nowrap text-right">
                        <button type="button" class="chip" (click)="editBlog(post)">{{ 'admin.edit' | translate }}</button>
                        <button
                          type="button"
                          class="chip ml-1 hover:border-red-600 hover:text-red-700"
                          (click)="askDelete('blog', post.id, post.title)"
                        >
                          {{ 'admin.delete' | translate }}
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }

          @case ('promo') {
            <div class="flex justify-end">
              <button type="button" class="btn-primary" (click)="newPromo()">{{ 'admin.create' | translate }}</button>
            </div>

            @if (editingPromo()) {
              <form class="card mt-6 grid gap-4 sm:grid-cols-3" [formGroup]="promoForm" (ngSubmit)="savePromo()">
                <label>
                  <span class="label-text">{{ 'admin.promo.code' | translate }}</span>
                  <input class="field mt-1 font-mono uppercase" formControlName="code" />
                </label>
                <label>
                  <span class="label-text">{{ 'admin.promo.percent' | translate }}</span>
                  <input class="field mt-1" type="number" min="0" max="100" formControlName="discount_percent" />
                </label>
                <label>
                  <span class="label-text">{{ 'admin.promo.amount' | translate }}</span>
                  <input class="field mt-1" type="number" min="0" formControlName="discount_amount" />
                </label>
                <label>
                  <span class="label-text">{{ 'admin.promo.limit' | translate }}</span>
                  <input class="field mt-1" type="number" min="0" formControlName="usage_limit" />
                </label>
                <label>
                  <span class="label-text">{{ 'admin.promo.type' | translate }}</span>
                  <select class="field mt-1" formControlName="type">
                    <option value="general">general</option>
                    <option value="referral_referee">referral_referee</option>
                    <option value="referral_referrer">referral_referrer</option>
                  </select>
                </label>
                <label class="flex items-end gap-2 pb-2 text-sm">
                  <input type="checkbox" class="accent-gold" formControlName="is_active" />
                  {{ 'admin.promo.active' | translate }}
                </label>
                <div class="flex gap-2 sm:col-span-3">
                  <button class="btn-primary" type="submit" [disabled]="promoForm.invalid">
                    {{ 'admin.save' | translate }}
                  </button>
                  <button type="button" class="btn-secondary" (click)="editingPromo.set(false)">
                    {{ 'admin.cancel' | translate }}
                  </button>
                </div>
              </form>
            }

            <div class="mt-6 overflow-x-auto">
              <table class="table-basic">
                <thead>
                  <tr>
                    <th>{{ 'admin.promo.code' | translate }}</th>
                    <th>{{ 'admin.promo.percent' | translate }}</th>
                    <th>{{ 'admin.promo.used' | translate }}</th>
                    <th>{{ 'admin.promo.type' | translate }}</th>
                    <th>{{ 'admin.promo.active' | translate }}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (promo of promoCodes(); track promo.id) {
                    <tr>
                      <td class="font-mono">{{ promo.code }}</td>
                      <td>
                        @if (promo.discount_amount) {
                          {{ promo.discount_amount | price }}
                        } @else {
                          {{ promo.discount_percent }}%
                        }
                      </td>
                      <td>{{ promo.times_used }}/{{ promo.usage_limit ?? '∞' }}</td>
                      <td class="text-xs text-charcoal/60">{{ promo.type }}</td>
                      <td>{{ (promo.is_active ? 'common.yes' : 'common.no') | translate }}</td>
                      <td class="whitespace-nowrap text-right">
                        <button type="button" class="chip" (click)="editPromo(promo)">{{ 'admin.edit' | translate }}</button>
                        <button
                          type="button"
                          class="chip ml-1 hover:border-red-600 hover:text-red-700"
                          (click)="askDelete('promo', promo.id, promo.code)"
                        >
                          {{ 'admin.delete' | translate }}
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        }
      </div>
    </div>

    <app-confirm-dialog
      [open]="pendingDelete() !== null"
      [title]="'admin.delete' | translate"
      [message]="deleteMessage()"
      (confirmed)="runDelete()"
      (cancelled)="pendingDelete.set(null)"
    />
  `,
  styles: [
    `
      .label-text {
        @apply block text-xs font-semibold uppercase tracking-wide text-charcoal/50;
      }
    `
  ]
})
export class AdminPage {
  private readonly admin = inject(AdminService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly language = inject(LanguageService);

  readonly tabs: Tab[] = ['dashboard', 'products', 'categories', 'orders', 'users', 'reviews', 'blog', 'promo'];
  readonly orderStatuses = ORDER_STATUSES;
  readonly reviewFilters = [
    { value: '', label: 'admin.all' },
    { value: 'false', label: 'account.reviewPending' },
    { value: 'true', label: 'account.reviewApproved' }
  ];

  readonly tab = signal<Tab>('dashboard');
  readonly stats = signal<AdminStats | null>(null);
  readonly products = signal<Product[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly orders = signal<Order[]>([]);
  readonly users = signal<AdminUser[]>([]);
  readonly reviews = signal<Review[]>([]);
  readonly promoCodes = signal<PromoCode[]>([]);
  readonly blogPosts = signal<BlogPost[]>([]);

  readonly productPage = signal(1);
  readonly productPages = signal(1);
  readonly productSearch = signal('');
  readonly orderPage = signal(1);
  readonly orderPages = signal(1);
  readonly orderSearch = signal('');
  readonly orderStatus = signal('');
  readonly userPage = signal(1);
  readonly userPages = signal(1);
  readonly userSearch = signal('');
  readonly reviewPage = signal(1);
  readonly reviewPages = signal(1);
  readonly reviewFilter = signal('');

  readonly editingProduct = signal(false);
  readonly editingCategory = signal(false);
  readonly editingPromo = signal(false);
  readonly editingBlog = signal(false);
  /** Signal so the template can show gallery and variant panels only for a saved product. */
  readonly editingProductId = signal<number | null>(null);
  readonly editingImages = signal<ProductImage[]>([]);
  readonly editingVariants = signal<Variant[]>([]);
  readonly editingVariantId = signal<number | null>(null);
  readonly uploadError = signal<string | null>(null);
  private editingCategoryId: number | null = null;
  /** Preserved across an edit so saving a rename does not reset the menu order. */
  private editingCategoryPosition = 0;
  private editingPromoId: number | null = null;
  private editingBlogId: number | null = null;

  readonly pendingDelete = signal<PendingDelete | null>(null);
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  readonly productForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    slug: ['', Validators.required],
    description: ['', Validators.required],
    price: [0, [Validators.required, Validators.min(0)]],
    discount_price: [null as number | null],
    category_id: [0, Validators.required],
    brand: ['', Validators.required],
    stock_quantity: [0, [Validators.required, Validators.min(0)]],
    status: ['active' as 'active' | 'inactive'],
    is_featured: [false]
  });

  readonly variantForm = this.fb.nonNullable.group({
    size: [''],
    color: [''],
    sku: ['', Validators.required],
    stock_quantity: [0, [Validators.required, Validators.min(0)]],
    extra_price: [0, [Validators.min(0)]]
  });

  readonly categoryForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    slug: ['', Validators.required],
    image_url: [''],
    parent_category_id: ['' as string]
  });

  readonly promoForm = this.fb.nonNullable.group({
    code: ['', Validators.required],
    discount_percent: [10, [Validators.min(0), Validators.max(100)]],
    discount_amount: [null as number | null],
    usage_limit: [null as number | null],
    is_active: [true],
    type: ['general' as PromoCode['type']]
  });

  readonly blogForm = this.fb.nonNullable.group({
    title: ['', Validators.required],
    slug: ['', Validators.required],
    excerpt: ['', Validators.required],
    content: ['', Validators.required],
    cover_image_url: [''],
    category: ['style', Validators.required],
    is_published: [true]
  });

  readonly statCards = computed(() => {
    const s = this.stats();
    if (!s) return [];
    return [
      { label: 'admin.statOrders', value: s.orders, currency: false },
      { label: 'admin.statRevenue', value: s.revenue_total, currency: true },
      { label: 'admin.statRevenuePeriod', value: s.revenue_period, currency: true },
      { label: 'admin.statAov', value: s.average_order_value, currency: true },
      { label: 'admin.statUsers', value: s.users, currency: false },
      { label: 'admin.statProducts', value: s.products, currency: false },
      { label: 'admin.statPendingReviews', value: s.pending_reviews, currency: false },
      { label: 'admin.statSubscribers', value: s.newsletter_subscribers, currency: false }
    ];
  });

  constructor() {
    const requested = this.route.snapshot.queryParamMap.get('tab') as Tab | null;
    if (requested && this.tabs.includes(requested)) this.tab.set(requested);
    effect(
      () => {
        this.language.lang();
        this.admin.stats().subscribe({ next: (data) => this.stats.set(data), error: () => undefined });
        this.admin.categories().subscribe({ next: (items) => this.categories.set(items), error: () => undefined });
        this.loadForTab(this.tab());
      },
      { allowSignalWrites: true }
    );
  }

  tabLabel(tab: Tab) {
    return `admin.tab${tab.charAt(0).toUpperCase()}${tab.slice(1)}`;
  }

  setTab(tab: Tab) {
    this.tab.set(tab);
    this.router.navigate([], { relativeTo: this.route, queryParams: { tab }, queryParamsHandling: 'merge' });
  }

  /** Each tab fetches only what it shows, so opening the panel is one request, not eight. */
  private loadForTab(tab: Tab) {
    if (tab === 'products') this.loadProducts(1);
    if (tab === 'orders') this.loadOrders(1);
    if (tab === 'users') this.loadUsers(1);
    if (tab === 'reviews') this.loadReviews(1);
    if (tab === 'promo') this.loadPromos();
    if (tab === 'blog') this.loadBlog();
    if (tab === 'categories') this.loadCategories();
  }

  private fail(error: { error?: { detail?: string } }) {
    this.toast.error(error.error?.detail ?? this.translate.instant('common.error'));
  }

  private ok() {
    this.toast.show(this.translate.instant('admin.saved'));
  }

  seriesStart() {
    return this.stats()?.revenue_series[0]?.date ?? '';
  }

  seriesEnd() {
    const series = this.stats()?.revenue_series ?? [];
    return series.length ? series[series.length - 1].date : '';
  }

  barHeight(revenue: number) {
    const series = this.stats()?.revenue_series ?? [];
    const max = Math.max(...series.map((point) => point.revenue), 1);
    // Keep a visible sliver for zero days so the axis reads as a continuous timeline.
    return Math.max((revenue / max) * 100, 2);
  }

  starsFor(rating: number) {
    return '★★★★★'.slice(0, rating).padEnd(5, '☆');
  }

  parentName(category: Category) {
    if (!category.parent_category_id) return '—';
    return this.categories().find((item) => item.id === category.parent_category_id)?.name ?? '—';
  }

  private debounce(action: () => void) {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(action, 300);
  }

  // --- products ---
  loadProducts(page: number) {
    this.productPage.set(page);
    this.admin.products({ page, search: this.productSearch() || undefined }).subscribe({
      next: (result) => {
        this.products.set(result.items);
        this.productPages.set(result.pages);
      },
      error: (error) => this.fail(error)
    });
  }

  searchProducts(term: string) {
    this.productSearch.set(term);
    this.debounce(() => this.loadProducts(1));
  }

  newProduct() {
    this.editingProductId.set(null);
    this.editingImages.set([]);
    this.editingVariants.set([]);
    this.resetVariantForm();
    this.productForm.reset({
      name: '',
      slug: '',
      description: '',
      price: 0,
      discount_price: null,
      category_id: this.categories()[0]?.id ?? 0,
      brand: '',
      stock_quantity: 0,
      status: 'active',
      is_featured: false
    });
    this.editingProduct.set(true);
  }

  editProduct(product: Product) {
    this.editingProductId.set(product.id);
    this.editingImages.set([...product.images].sort((a, b) => a.position - b.position));
    this.editingVariants.set(product.variants);
    this.resetVariantForm();
    this.productForm.patchValue({
      name: product.name,
      slug: product.slug,
      description: product.description,
      price: product.price,
      discount_price: product.discount_price,
      category_id: product.category_id,
      brand: product.brand,
      stock_quantity: product.stock_quantity,
      status: product.status,
      is_featured: product.is_featured
    });
    this.editingProduct.set(true);
  }

  /** Only fills the slug while creating, so an existing product keeps its URL. */
  autoSlug() {
    if (this.editingProductId() !== null) return;
    const name = this.productForm.getRawValue().name;
    const slug = name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'dj')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    this.productForm.patchValue({ slug }, { emitEvent: false });
  }

  saveProduct() {
    if (this.productForm.invalid) return;
    const value = this.productForm.getRawValue();
    const body = {
      ...value,
      price: Number(value.price),
      discount_price: value.discount_price ? Number(value.discount_price) : null,
      category_id: Number(value.category_id),
      stock_quantity: Number(value.stock_quantity)
    };
    const editingId = this.editingProductId();
    const request = editingId ? this.admin.updateProduct(editingId, body) : this.admin.createProduct(body);
    request.subscribe({
      next: (saved) => {
        this.ok();
        // Stay in the form after creating, so images and variants can be added
        // straight away instead of forcing a save-then-reopen round trip.
        this.editingProductId.set(saved.id);
        this.editingImages.set([...saved.images].sort((a, b) => a.position - b.position));
        this.editingVariants.set(saved.variants);
        this.loadProducts(this.productPage());
      },
      error: (error) => this.fail(error)
    });
  }

  // --- product gallery ---
  uploadImage(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const productId = this.editingProductId();
    if (!file || !productId) return;
    this.uploadError.set(null);

    this.admin.uploadImage(productId, file).subscribe({
      next: (image) => {
        this.editingImages.update((images) => [...images, image]);
        this.ok();
        // Clear the input so re-picking the same file still fires a change event.
        input.value = '';
      },
      error: (error: { error?: { detail?: string } }) => {
        this.uploadError.set(error.error?.detail ?? this.translate.instant('common.error'));
        input.value = '';
      }
    });
  }

  removeImage(image: ProductImage) {
    const productId = this.editingProductId();
    if (!productId) return;
    this.admin.deleteImage(productId, image.id).subscribe({
      next: () => {
        this.editingImages.update((images) => images.filter((item) => item.id !== image.id));
        this.toast.show(this.translate.instant('admin.deleted'));
      },
      error: (error) => this.fail(error)
    });
  }

  // --- product variants ---
  resetVariantForm() {
    this.editingVariantId.set(null);
    this.variantForm.reset({ size: '', color: '', sku: '', stock_quantity: 0, extra_price: 0 });
  }

  editVariant(variant: Variant) {
    this.editingVariantId.set(variant.id);
    this.variantForm.patchValue({
      size: variant.size ?? '',
      color: variant.color ?? '',
      sku: variant.sku,
      stock_quantity: variant.stock_quantity,
      extra_price: variant.extra_price
    });
  }

  saveVariant() {
    const productId = this.editingProductId();
    if (!productId || this.variantForm.invalid) return;
    const value = this.variantForm.getRawValue();
    const body: VariantInput = {
      size: value.size || null,
      color: value.color || null,
      sku: value.sku.trim(),
      stock_quantity: Number(value.stock_quantity) || 0,
      extra_price: Number(value.extra_price) || 0
    };
    const variantId = this.editingVariantId();
    const request = variantId
      ? this.admin.updateVariant(productId, variantId, body)
      : this.admin.createVariant(productId, body);

    request.subscribe({
      next: (saved) => {
        this.editingVariants.update((variants) =>
          variantId ? variants.map((item) => (item.id === saved.id ? saved : item)) : [...variants, saved]
        );
        this.resetVariantForm();
        this.ok();
      },
      error: (error) => this.fail(error)
    });
  }

  removeVariant(variant: Variant) {
    const productId = this.editingProductId();
    if (!productId) return;
    this.admin.deleteVariant(productId, variant.id).subscribe({
      next: () => {
        this.editingVariants.update((variants) => variants.filter((item) => item.id !== variant.id));
        if (this.editingVariantId() === variant.id) this.resetVariantForm();
        this.toast.show(this.translate.instant('admin.deleted'));
      },
      error: (error) => this.fail(error)
    });
  }

  // --- categories ---
  loadCategories() {
    this.admin.categories().subscribe({ next: (items) => this.categories.set(items), error: (e) => this.fail(e) });
  }

  newCategory() {
    this.editingCategoryId = null;
    this.editingCategoryPosition = 0;
    this.categoryForm.reset({ name: '', slug: '', image_url: '', parent_category_id: '' });
    this.editingCategory.set(true);
  }

  editCategory(category: Category) {
    this.editingCategoryId = category.id;
    this.editingCategoryPosition = category.position;
    this.categoryForm.patchValue({
      name: category.name,
      slug: category.slug,
      image_url: category.image_url ?? '',
      parent_category_id: category.parent_category_id ? String(category.parent_category_id) : ''
    });
    this.editingCategory.set(true);
  }

  saveCategory() {
    if (this.categoryForm.invalid) return;
    const value = this.categoryForm.getRawValue();
    const body = {
      name: value.name,
      slug: value.slug,
      image_url: value.image_url || null,
      position: this.editingCategoryPosition,
      parent_category_id: value.parent_category_id ? Number(value.parent_category_id) : null
    };
    const request = this.editingCategoryId
      ? this.admin.updateCategory(this.editingCategoryId, body)
      : this.admin.createCategory(body);
    request.subscribe({
      next: () => {
        this.ok();
        this.editingCategory.set(false);
        this.loadCategories();
      },
      error: (error) => this.fail(error)
    });
  }

  // --- orders ---
  loadOrders(page: number) {
    this.orderPage.set(page);
    this.admin
      .orders({ page, status: this.orderStatus() || undefined, search: this.orderSearch() || undefined })
      .subscribe({
        next: (result) => {
          this.orders.set(result.items);
          this.orderPages.set(result.pages);
        },
        error: (error) => this.fail(error)
      });
  }

  searchOrders(term: string) {
    this.orderSearch.set(term);
    this.debounce(() => this.loadOrders(1));
  }

  filterOrders(status: string) {
    this.orderStatus.set(status);
    this.loadOrders(1);
  }

  changeOrderStatus(order: Order, status: OrderStatus) {
    this.admin.updateOrderStatus(order.id, status).subscribe({
      next: () => {
        this.ok();
        this.loadOrders(this.orderPage());
      },
      error: (error) => this.fail(error)
    });
  }

  // --- users ---
  loadUsers(page: number) {
    this.userPage.set(page);
    this.admin.users({ page, search: this.userSearch() || undefined }).subscribe({
      next: (result) => {
        this.users.set(result.items);
        this.userPages.set(result.pages);
      },
      error: (error) => this.fail(error)
    });
  }

  searchUsers(term: string) {
    this.userSearch.set(term);
    this.debounce(() => this.loadUsers(1));
  }

  changeRole(user: AdminUser, role: Role) {
    this.admin.updateRole(user.id, role).subscribe({
      next: () => {
        this.ok();
        this.loadUsers(this.userPage());
      },
      // The API refuses to remove the last admin; reload so the select snaps back.
      error: (error) => {
        this.fail(error);
        this.loadUsers(this.userPage());
      }
    });
  }

  // --- reviews ---
  loadReviews(page: number) {
    this.reviewPage.set(page);
    this.admin.reviews({ page, approved: this.reviewFilter() || undefined }).subscribe({
      next: (result) => {
        this.reviews.set(result.items);
        this.reviewPages.set(result.pages);
      },
      error: (error) => this.fail(error)
    });
  }

  filterReviews(value: string) {
    this.reviewFilter.set(value);
    this.loadReviews(1);
  }

  approveReview(review: Review) {
    this.admin.approveReview(review.id).subscribe({
      next: () => {
        this.ok();
        this.loadReviews(this.reviewPage());
      },
      error: (error) => this.fail(error)
    });
  }

  rejectReview(review: Review) {
    this.admin.rejectReview(review.id).subscribe({
      next: () => {
        this.ok();
        this.loadReviews(this.reviewPage());
      },
      error: (error) => this.fail(error)
    });
  }

  // --- promo codes ---
  loadPromos() {
    this.admin.promoCodes().subscribe({ next: (items) => this.promoCodes.set(items), error: (e) => this.fail(e) });
  }

  newPromo() {
    this.editingPromoId = null;
    this.promoForm.reset({
      code: '',
      discount_percent: 10,
      discount_amount: null,
      usage_limit: null,
      is_active: true,
      type: 'general'
    });
    this.editingPromo.set(true);
  }

  editPromo(promo: PromoCode) {
    this.editingPromoId = promo.id;
    this.promoForm.patchValue({
      code: promo.code,
      discount_percent: promo.discount_percent,
      discount_amount: promo.discount_amount,
      usage_limit: promo.usage_limit,
      is_active: promo.is_active,
      type: promo.type
    });
    this.editingPromo.set(true);
  }

  savePromo() {
    if (this.promoForm.invalid) return;
    const value = this.promoForm.getRawValue();
    const body = {
      code: value.code,
      discount_percent: Number(value.discount_percent) || 0,
      discount_amount: value.discount_amount ? Number(value.discount_amount) : null,
      usage_limit: value.usage_limit ? Number(value.usage_limit) : null,
      is_active: value.is_active,
      expires_at: null,
      type: value.type
    };
    const request = this.editingPromoId ? this.admin.updatePromo(this.editingPromoId, body) : this.admin.createPromo(body);
    request.subscribe({
      next: () => {
        this.ok();
        this.editingPromo.set(false);
        this.loadPromos();
      },
      error: (error) => this.fail(error)
    });
  }

  // --- blog ---
  loadBlog() {
    this.admin.blogPosts().subscribe({ next: (items) => this.blogPosts.set(items), error: (e) => this.fail(e) });
  }

  newBlog() {
    this.editingBlogId = null;
    this.blogForm.reset({
      title: '',
      slug: '',
      excerpt: '',
      content: '',
      cover_image_url: '',
      category: 'style',
      is_published: true
    });
    this.editingBlog.set(true);
  }

  editBlog(post: BlogPost) {
    this.editingBlogId = post.id;
    this.blogForm.patchValue({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content: post.content,
      cover_image_url: post.cover_image_url ?? '',
      category: post.category,
      is_published: post.is_published
    });
    this.editingBlog.set(true);
  }

  saveBlog() {
    if (this.blogForm.invalid) return;
    const value = this.blogForm.getRawValue();
    const body = { ...value, cover_image_url: value.cover_image_url || null };
    const request = this.editingBlogId ? this.admin.updateBlog(this.editingBlogId, body) : this.admin.createBlog(body);
    request.subscribe({
      next: () => {
        this.ok();
        this.editingBlog.set(false);
        this.loadBlog();
      },
      error: (error) => this.fail(error)
    });
  }

  // --- deletion ---
  askDelete(kind: PendingDelete['kind'], id: number, label: string) {
    this.pendingDelete.set({ kind, id, label });
  }

  deleteMessage() {
    const pending = this.pendingDelete();
    return pending ? this.translate.instant('admin.confirmDelete', { name: pending.label }) : '';
  }

  runDelete() {
    const pending = this.pendingDelete();
    this.pendingDelete.set(null);
    if (!pending) return;

    const done = () => {
      this.toast.show(this.translate.instant('admin.deleted'));
      this.loadForTab(this.tab());
    };

    switch (pending.kind) {
      case 'product':
        this.admin.deleteProduct(pending.id).subscribe({ next: done, error: (e) => this.fail(e) });
        break;
      case 'category':
        this.admin.deleteCategory(pending.id).subscribe({ next: done, error: (e) => this.fail(e) });
        break;
      case 'review':
        this.admin.deleteReview(pending.id).subscribe({ next: done, error: (e) => this.fail(e) });
        break;
      case 'promo':
        this.admin.deletePromo(pending.id).subscribe({ next: done, error: (e) => this.fail(e) });
        break;
      case 'blog':
        this.admin.deleteBlog(pending.id).subscribe({ next: done, error: (e) => this.fail(e) });
        break;
    }
  }
}
