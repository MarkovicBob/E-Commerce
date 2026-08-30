export type Lang = 'sr' | 'en' | 'de';
export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
export type Role = 'customer' | 'admin';

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  phone: string | null;
  role: Role;
  referral_code: string;
  created_at?: string;
}

export interface Category {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  position: number;
  parent_category_id: number | null;
}

export interface CategoryNode extends Category {
  children: CategoryNode[];
  product_count: number;
}

export interface CategoryDetail extends Category {
  breadcrumb: Category[];
  children: Category[];
  product_count: number;
}

export interface ProductImage {
  id: number;
  image_url: string;
  position: number;
}

export interface Variant {
  id: number;
  size: string | null;
  color: string | null;
  sku: string;
  stock_quantity: number;
  extra_price: number;
}

export interface Product {
  id: number;
  slug: string;
  name: string;
  description: string;
  price: number;
  discount_price: number | null;
  effective_price: number;
  discount_percent: number;
  category_id: number;
  category_slug: string | null;
  category_name: string | null;
  brand: string;
  stock_quantity: number;
  in_stock: boolean;
  status: 'active' | 'inactive';
  average_rating: number;
  review_count: number;
  sales_count: number;
  is_featured: boolean;
  specs: Record<string, string>;
  images: ProductImage[];
  variants: Variant[];
  created_at: string;
}

export interface Suggestion {
  name: string;
  slug: string;
  brand: string;
  image_url: string;
  price: number;
}

export interface Facets {
  brands: { value: string; count: number }[];
  sizes: string[];
  colors: string[];
  min_price: number;
  max_price: number;
}

export interface CartItem {
  id: number;
  product_id: number;
  variant_id: number | null;
  name: string;
  slug: string;
  brand: string;
  image_url: string | null;
  size: string | null;
  color: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  stock_quantity: number;
  in_stock: boolean;
}

export interface Cart {
  id: number;
  promo_code: string | null;
  promo_invalid: boolean;
  items: CartItem[];
  item_count: number;
  subtotal: number;
  discount_total: number;
  shipping_cost: number;
  shipping_method: string;
  total: number;
  has_stock_issue: boolean;
}

export interface Address {
  id: number;
  label: string | null;
  full_name: string;
  street: string;
  city: string;
  postal_code: string;
  country: string;
  phone: string;
  is_default: boolean;
}

export type AddressInput = Omit<Address, 'id'>;

export interface OrderItem {
  id: number;
  product_id: number;
  variant_id: number | null;
  name: string;
  slug: string | null;
  image_url: string | null;
  size: string | null;
  color: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface Order {
  id: number;
  order_number: string;
  status: OrderStatus;
  subtotal: number;
  discount_total: number;
  shipping_cost: number;
  total: number;
  shipping_address: Record<string, string>;
  shipping_method: string;
  payment_method: string;
  contact_email: string | null;
  promo_code_used: string | null;
  can_cancel: boolean;
  items: OrderItem[];
  item_count: number;
  created_at: string;
}

export interface Review {
  id: number;
  product_id: number;
  user_id: number;
  author: string;
  order_id: number;
  rating: number;
  comment: string | null;
  is_approved: boolean;
  created_at: string;
  product_name?: string;
}

export interface ReviewPage extends Page<Review> {
  average_rating: number;
  breakdown: Record<string, number>;
  pending_count?: number;
}

export interface BlogPost {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  cover_image_url: string | null;
  published_at: string | null;
  is_published: boolean;
  related?: BlogPost[];
}

export interface PromoCode {
  id: number;
  code: string;
  discount_percent: number;
  discount_amount: number | null;
  is_active: boolean;
  expires_at: string | null;
  usage_limit: number | null;
  times_used: number;
  type: 'general' | 'referral_referee' | 'referral_referrer';
}

export interface Referral {
  referral_code: string;
  referral_link: string;
  completed_referrals: number;
  coupons: PromoCode[];
}

export interface AdminUser extends User {
  order_count: number;
  total_spent: number;
}

export interface AdminStats {
  orders: number;
  orders_period: number;
  revenue_total: number;
  revenue_period: number;
  average_order_value: number;
  users: number;
  new_users_period: number;
  products: number;
  pending_reviews: number;
  newsletter_subscribers: number;
  low_stock: { id: number; name: string; stock_quantity: number }[];
  top_products: { name: string; quantity: number; revenue: number }[];
  orders_by_status: Record<OrderStatus, number>;
  revenue_series: { date: string; revenue: number }[];
  period_days: number;
}
