import { Routes } from '@angular/router';
import { adminGuard } from './core/guards/admin.guard';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    title: 'Luxe Commerce',
    loadComponent: () => import('./features/home/home.page').then((m) => m.HomePage)
  },
  {
    path: 'category/:slug',
    loadComponent: () => import('./features/catalog/catalog.page').then((m) => m.CatalogPage)
  },
  {
    path: 'search',
    loadComponent: () => import('./features/catalog/catalog.page').then((m) => m.CatalogPage)
  },
  {
    path: 'product/:slug',
    loadComponent: () => import('./features/product/product.page').then((m) => m.ProductPage)
  },
  {
    path: 'cart',
    loadComponent: () => import('./features/cart/cart.page').then((m) => m.CartPage)
  },
  {
    path: 'checkout',
    // Guest checkout is supported by the API, but the account flow is the one we route to.
    canActivate: [authGuard],
    loadComponent: () => import('./features/checkout/checkout.page').then((m) => m.CheckoutPage)
  },
  {
    path: 'order-confirmation/:orderNumber',
    loadComponent: () =>
      import('./features/checkout/order-confirmation.page').then((m) => m.OrderConfirmationPage)
  },
  {
    path: 'account',
    canActivate: [authGuard],
    loadComponent: () => import('./features/account/account.page').then((m) => m.AccountPage)
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage)
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register.page').then((m) => m.RegisterPage)
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./features/auth/forgot.page').then((m) => m.ForgotPage)
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./features/auth/reset.page').then((m) => m.ResetPage)
  },
  {
    path: 'blog',
    loadComponent: () => import('./features/blog/blog-list.page').then((m) => m.BlogListPage)
  },
  {
    path: 'blog/:slug',
    loadComponent: () => import('./features/blog/blog-post.page').then((m) => m.BlogPostPage)
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/admin/admin.page').then((m) => m.AdminPage)
  },
  { path: '**', redirectTo: '' }
];
