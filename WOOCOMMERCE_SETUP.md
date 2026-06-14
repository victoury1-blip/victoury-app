# WooCommerce Integration Setup

## Overview
This system now supports automatic synchronization with WooCommerce. When you add, update, or delete products marked as "WooCommerce" in your stock system, they will automatically sync to your WooCommerce store.

## Features
- **Add Products**: When you add a product with "WooCommerce" as the boutique, it automatically creates a variable product in WooCommerce with all variations
- **Update Products**: Changes to product name, price, status, and variations sync automatically
- **Delete Products**: Deleting a product from the stock system removes it from WooCommerce
- **Stock Sync**: Adjusting stock quantities automatically updates WooCommerce inventory
- **Sync Logs**: All sync operations are logged for troubleshooting

## Setup Instructions

### 1. Get WooCommerce API Credentials

1. Go to your WooCommerce admin dashboard
2. Navigate to **Settings > Advanced > REST API**
3. Click **Create an API key**
4. Fill in the details:
   - **Description**: Victoury Stock System
   - **User**: Select your admin user
   - **Permissions**: Read/Write (required for full functionality)
5. Click **Generate API key**
6. Copy the **Consumer Key** and **Consumer Secret**

### 2. Configure Environment Variables

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` and add your WooCommerce details:
   ```
   VITE_WOO_API_URL=https://your-woocommerce-site.com
   VITE_WOO_CONSUMER_KEY=your_consumer_key_here
   VITE_WOO_CONSUMER_SECRET=your_consumer_secret_here
   ```

3. Restart your development server for changes to take effect

### 3. Using WooCommerce Integration

#### Adding a Product
1. Click **Ajouter** (Add) button
2. Fill in product details
3. Select **WooCommerce** from the "Boutique" dropdown
4. Add variations with sizes and stock quantities
5. Click **Ajouter le produit**
6. The system will sync to WooCommerce and show a success message

#### Updating a Product
1. Click the edit button (pencil icon) on a WooCommerce product
2. Make your changes
3. Click **Enregistrer** (Save)
4. The system will sync changes to WooCommerce

#### Deleting a Product
1. Click the delete button (trash icon)
2. Confirm the deletion
3. The product will be removed from both your stock system and WooCommerce

#### Adjusting Stock
1. Click **Voir variations** on a product
2. Use the +/- buttons to adjust stock
3. Click the green checkmark to apply
4. If the product is on WooCommerce, stock will sync automatically

## Product Structure

### Main Product Fields
- **Nom du produit**: Product name (synced to WooCommerce)
- **Référence**: Product SKU (synced to WooCommerce)
- **Statut**: Active/Draft (synced to WooCommerce)
- **Boutique**: Select "WooCommerce" to enable syncing
- **Prix**: Regular price (synced to WooCommerce)
- **Compare-At Prix**: Sale price (synced to WooCommerce)

### Variations
Each variation includes:
- **Taille**: Size attribute (e.g., S, M, L, XL or 36, 37, 38, etc.)
- **Stock**: Quantity available
- **Prix**: Variation-specific price
- **Compare-At**: Variation-specific sale price

All variations are automatically created as variable products in WooCommerce.

## Sync Status Indicators

The system shows real-time sync status at the top of the Stock page:

- **Blue with spinner**: Synchronization in progress
- **Green with checkmark**: Sync successful
- **Red with X**: Sync failed (check error message)

## Troubleshooting

### "WooCommerce not configured"
- Check that `.env.local` exists and has the correct variables
- Verify the API credentials are correct
- Restart the development server

### "Failed to create product"
- Ensure your WooCommerce API key has Read/Write permissions
- Check that the WooCommerce REST API is enabled
- Verify the API URL is correct (should be your store's base URL)

### Stock not syncing
- Make sure the product is marked as "WooCommerce" in the Boutique field
- Check the browser console for error messages
- Verify the API credentials are still valid

### Products not appearing in WooCommerce
- Check that the product status is "Active"
- Verify the API key has Write permissions
- Check WooCommerce's product list to see if products were created

## Sync Logs

The system maintains a log of all sync operations. To view logs:

1. Open browser DevTools (F12)
2. Go to Application > Local Storage
3. Look for `victoury_woo_sync_log`
4. Each entry shows:
   - Timestamp
   - Product ID
   - Action (create/update/delete)
   - WooCommerce ID
   - Success status
   - Error message (if failed)

## API Endpoints Used

The system uses these WooCommerce REST API endpoints:

- `POST /wp-json/wc/v3/products` - Create product
- `PUT /wp-json/wc/v3/products/{id}` - Update product
- `DELETE /wp-json/wc/v3/products/{id}` - Delete product
- `POST /wp-json/wc/v3/products/{id}/variations` - Create variations
- `PUT /wp-json/wc/v3/products/{id}/variations/{var_id}` - Update variation stock

## Security Notes

- **Never commit `.env.local`** - It contains sensitive credentials
- API credentials are stored in environment variables, not in code
- Credentials are only sent over HTTPS to WooCommerce
- Consider using a separate API key for this integration with limited permissions

## Support

If you encounter issues:
1. Check the sync status message for error details
2. Review the sync logs in browser storage
3. Verify WooCommerce API credentials
4. Check that your WooCommerce site is accessible
5. Ensure the REST API is enabled in WooCommerce settings
