import { inject, Injectable } from '@angular/core';
import {
  AdminStats,
  AdminUser,
  BlogPost,
  Category,
  Order,
  OrderStatus,
  Page,
  Product,
  ProductImage,
  PromoCode,
  ReviewPage,
  Role,
  Variant
} from '../models';
import { ApiService, QueryParams } from './api.service';
import { LanguageService } from './language.service';

export interface ProductInput {
  name: string;
  slug: string;
  description: string;
  price: number;
  discount_price: number | null;
  category_id: number;
  brand: string;
  stock_quantity: number;
  status: 'active' | 'inactive';
  is_featured: boolean;
  specs?: Record<string, string> | null;
}

export interface VariantInput {
  size: string | null;
  color: string | null;
  sku: string;
  stock_quantity: number;
  extra_price: number;
}

export interface CategoryInput {
  name: string;
  slug: string;
  description?: string | null;
  image_url?: string | null;
  position: number;
  parent_category_id: number | null;
}

export interface PromoInput {
  code: string;
  discount_percent: number;
  discount_amount: number | null;
  is_active: boolean;
  expires_at: string | null;
  usage_limit: number | null;
  type: PromoCode['type'];
}

export interface BlogInput {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  cover_image_url: string | null;
  category: string;
  is_published: boolean;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly api = inject(ApiService);
  private readonly language = inject(LanguageService);

  stats(days = 30) {
    return this.api.get<AdminStats>('/admin/stats', { days });
  }

  products(params: QueryParams = {}) {
    return this.api.get<Page<Product>>('/admin/products', { ...params, lang: this.language.lang() });
  }
  createProduct(body: ProductInput) {
    return this.api.post<Product>('/products', body);
  }
  updateProduct(id: number, body: ProductInput) {
    return this.api.put<Product>(`/products/${id}`, body);
  }
  /** The API retires a product rather than deleting it, so order history stays intact. */
  deleteProduct(id: number) {
    return this.api.delete<{ detail: string }>(`/products/${id}`);
  }

  /** Multipart upload; the browser sets the boundary, so no Content-Type here. */
  uploadImage(productId: number, file: File) {
    const body = new FormData();
    body.append('file', file);
    return this.api.post<ProductImage>(`/products/${productId}/images`, body);
  }
  deleteImage(productId: number, imageId: number) {
    return this.api.delete<{ detail: string }>(`/products/${productId}/images/${imageId}`);
  }

  createVariant(productId: number, body: VariantInput) {
    return this.api.post<Variant>(`/products/${productId}/variants`, body);
  }
  updateVariant(productId: number, variantId: number, body: VariantInput) {
    return this.api.put<Variant>(`/products/${productId}/variants/${variantId}`, body);
  }
  deleteVariant(productId: number, variantId: number) {
    return this.api.delete<{ detail: string }>(`/products/${productId}/variants/${variantId}`);
  }

  categories() {
    return this.api.get<Category[]>('/categories', { lang: this.language.lang() });
  }
  createCategory(body: CategoryInput) {
    return this.api.post<Category>('/categories', body);
  }
  updateCategory(id: number, body: CategoryInput) {
    return this.api.put<Category>(`/categories/${id}`, body);
  }
  deleteCategory(id: number) {
    return this.api.delete<{ detail: string }>(`/categories/${id}`);
  }

  users(params: QueryParams = {}) {
    return this.api.get<Page<AdminUser>>('/admin/users', params);
  }
  updateRole(id: number, role: Role) {
    return this.api.put<AdminUser>(`/admin/users/${id}/role`, { role });
  }

  orders(params: QueryParams = {}) {
    return this.api.get<Page<Order>>('/admin/orders', { ...params, lang: this.language.lang() });
  }
  updateOrderStatus(id: number, status: OrderStatus) {
    return this.api.put<Order>(`/admin/orders/${id}/status`, { status }, { lang: this.language.lang() });
  }

  reviews(params: QueryParams = {}) {
    return this.api.get<ReviewPage>('/admin/reviews', { ...params, lang: this.language.lang() });
  }
  approveReview(id: number) {
    return this.api.put(`/admin/reviews/${id}/approve`);
  }
  rejectReview(id: number) {
    return this.api.put(`/admin/reviews/${id}/reject`);
  }
  deleteReview(id: number) {
    return this.api.delete(`/admin/reviews/${id}`);
  }

  promoCodes() {
    return this.api.get<PromoCode[]>('/admin/promo-codes');
  }
  createPromo(body: PromoInput) {
    return this.api.post<PromoCode>('/admin/promo-codes', body);
  }
  updatePromo(id: number, body: PromoInput) {
    return this.api.put<PromoCode>(`/admin/promo-codes/${id}`, body);
  }
  deletePromo(id: number) {
    return this.api.delete(`/admin/promo-codes/${id}`);
  }

  blogPosts() {
    return this.api.get<BlogPost[]>('/admin/blog', { lang: this.language.lang() });
  }
  createBlog(body: BlogInput) {
    return this.api.post<BlogPost>('/admin/blog', body);
  }
  updateBlog(id: number, body: BlogInput) {
    return this.api.put<BlogPost>(`/admin/blog/${id}`, body);
  }
  deleteBlog(id: number) {
    return this.api.delete(`/admin/blog/${id}`);
  }
}
