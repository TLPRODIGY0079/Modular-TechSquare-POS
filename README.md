# TECHSQUARE Multi-Store POS System

A modern, production-ready Point of Sale (POS) system with multi-store support, offline-first architecture, and Supabase backend integration.

## Features

- **Multi-Store Support**: Manage multiple store locations from a single interface
- **Inventory Management**: Track products, variants, and stock levels across stores
- **Sales & POS**: Complete point-of-sale functionality with cart management
- **Layby Management**: Handle layaway transactions and payments
- **Agent Commissions**: Track sales agents and calculate commissions
- **Warehouse Operations**: Central stock management and transfer operations
- **Trade-In System**: Process customer trade-ins
- **Expense Tracking**: Record and categorize business expenses
- **Offline-First**: Works without internet connection using IndexedDB
- **Real-Time Sync**: Automatic synchronization with Supabase when online
- **Barcode Scanning**: Integrated barcode/QR code scanning
- **Reports & Analytics**: Dashboard with sales charts and performance metrics
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Dark Mode**: Theme switching support

## Tech Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Backend**: Supabase (PostgreSQL, Real-time, Auth)
- **Offline Storage**: IndexedDB via custom offline-db.js
- **Charts**: Chart.js
- **PDF Generation**: jsPDF
- **Excel Export**: SheetJS
- **Barcode Scanning**: HTML5-QRCode

## Project Structure

```
techsquare-pos/
├── public/                      # Static files
│   ├── index.html              # Main HTML entry point
│   ├── css/                    # Modular CSS
│   │   ├── main.css           # Global styles and variables
│   │   ├── components.css     # UI components
│   │   ├── layouts.css        # Layout styles
│   │   ├── pages.css          # Page-specific styles
│   │   └── responsive.css     # Media queries
│   ├── js/                     # Modular JavaScript
│   │   ├── app.js             # Main entry point
│   │   ├── config.js          # Configuration and constants
│   │   ├── utils.js           # Utility functions
│   │   ├── supabase-client.js # Supabase client setup
│   │   ├── db.js              # Database state management
│   │   ├── auth.js            # Authentication
│   │   ├── offline-db.js      # IndexedDB wrapper
│   │   ├── ui/                # UI components
│   │   │   ├── toast.js       # Toast notifications
│   │   │   ├── modal.js       # Modal management
│   │   │   └── navigation.js  # Navigation and routing
│   │   └── services/          # Business logic
│   │       ├── products.js    # Product management
│   │       ├── sales.js       # Sales and POS
│   │       ├── layby.js       # Layby management
│   │       ├── agents.js      # Agent commissions
│   │       ├── warehouse.js   # Warehouse operations
│   │       ├── expenses.js    # Expense tracking
│   │       ├── tradein.js     # Trade-in processing
│   │       └── dashboard.js   # Dashboard and reports
│   └── images/                # Images and assets
├── supabase/                   # Supabase migrations
│   └── migrations/            # Database migration files
├── package.json               # Node.js dependencies
├── vercel.json               # Vercel deployment config
├── netlify.toml              # Netlify deployment config
├── .env.example              # Environment variables template
└── README.md                 # This file
```

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- A Supabase project account
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd techsquare-pos
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Supabase**
   - Create a new project at [supabase.com](https://supabase.com)
   - Run the provided migration scripts in the Supabase SQL editor
   - Copy your Supabase URL and anon key

4. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your Supabase credentials:
   ```
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

5. **Update configuration**
   Edit `public/js/config.js` with your Supabase credentials:
   ```javascript
   const SUPABASE_URL = "https://your-project-id.supabase.co";
   const SUPABASE_ANON_KEY = "your-anon-key-here";
   ```

### Local Development

1. **Start the development server**
   ```bash
   npm run dev
   ```

2. **Open in browser**
   Navigate to `http://localhost:3000`

### Building for Production

This is a static site, so no build process is required. The files in the `public/` directory are ready for deployment.

## Deployment

### Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel`
3. Follow the prompts
4. Set environment variables in Vercel dashboard

### Netlify

1. Connect your repository to Netlify
2. Set build command: `echo 'No build step required'`
3. Set publish directory: `public`
4. Add environment variables in Netlify dashboard

### Manual Deployment

Simply upload the contents of the `public/` directory to any static hosting service.

## Database Schema

The application requires the following Supabase tables:

- `user_profiles` - User authentication and roles
- `products` - Product catalog
- `variants` - Product variants (colors, storage, etc.)
- `serialized_items` - Serialized inventory items
- `sales` - Sales transactions
- `stock_transfers` - Inter-store stock transfers
- `trade_in_transactions` - Trade-in records
- `expenses` - Business expenses
- `layby_transactions` - Layaway transactions
- `layby_payments` - Layaway payment records
- `commission_records` - Agent commission calculations

See `supabase/migrations/` for the complete schema and migration files.

## User Roles

- **Admin**: Full access to all features
- **Store Manager**: Access to store operations, reports, and inventory
- **Warehouse Manager**: Access to warehouse operations
- **Cashier**: Access to POS and basic inventory

## Offline Functionality

The application works offline using IndexedDB:
- Data is cached locally for offline access
- Changes are queued and synced when connection is restored
- Manual offline mode can be toggled in the UI

## Security Features

- Supabase Row Level Security (RLS) enabled
- Secure authentication with session management
- Role-based access control
- XSS protection with HTML escaping
- Secure headers configured

## Browser Support

- Chrome/Edge (recommended)
- Firefox
- Safari
- Mobile browsers (iOS Safari, Chrome Mobile)

## Performance

- Lazy loading of modules
- Optimized CSS with CSS variables
- Efficient state management
- Offline caching strategy
- Code splitting ready

## Troubleshooting

### Supabase Connection Issues
- Check your SUPABASE_URL and SUPABASE_ANON_KEY
- Verify your Supabase project is active
- Check browser console for specific errors

### Offline Mode Not Working
- Ensure IndexedDB is enabled in browser
- Check browser console for offline-db.js errors
- Verify sufficient storage quota

### Barcode Scanner Not Working
- Ensure HTTPS is enabled (required for camera access)
- Check browser permissions for camera access
- Try a different browser if issues persist

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - feel free to use this project for any purpose.

## Support

For issues and questions:
- Create an issue in the GitHub repository
- Check existing documentation
- Review Supabase documentation at https://supabase.com/docs

## Version History

- **v2.0.5** - Financial fixes + cost_price corrections
- Previous versions - See git commit history

---

Built with ❤️ for modern retail operations