# ReformDental Azure Setup Guide

This guide will walk you through setting up Azure SQL Database and Azure Functions for your ReformDental application.

## Prerequisites

- Azure Account (create one at https://portal.azure.com)
- Node.js 18+ installed
- Azure Functions Core Tools (optional, for local testing)

---

## Step 1: Create Azure SQL Database

### 1.1 Go to Azure Portal
1. Navigate to https://portal.azure.com
2. Click **"+ Create a resource"**
3. Search for **"SQL Database"**
4. Click **"Create"**

### 1.2 Configure the Database

#### Basics Tab:
| Setting | Value |
|---------|-------|
| Subscription | Your subscription |
| Resource Group | Create new: `reform-dental-rg` |
| Database name | `ReformDentalDB` |
| Server | Click "Create new" |

#### Create New Server:
| Setting | Value |
|---------|-------|
| Server name | `reform-dental-server` (must be unique) |
| Location | Select closest to you |
| Authentication | Use SQL authentication |
| Server admin login | `reformdentaladmin` |
| Password | Create a strong password! |

#### Compute + Storage:
- Click **"Configure database"**
- Select **"Basic"** tier for development ($5/month) or **"Standard S0"** for production
- Click **"Apply"**

### 1.3 Networking Tab
- **Connectivity method**: Public endpoint
- **Allow Azure services**: Yes ✓
- **Add current client IP**: Yes ✓

### 1.4 Review + Create
- Click **"Review + create"**
- Click **"Create"**
- Wait for deployment (2-3 minutes)

---

## Step 2: Run the Database Schema

### 2.1 Open Query Editor
1. Go to your SQL Database in Azure Portal
2. Click **"Query editor (preview)"** in the left menu
3. Login with your SQL admin credentials

### 2.2 Run the Schema
1. Open the file `database/schema.sql` from this repository
2. Copy ALL the contents
3. Paste into the Query editor
4. Click **"Run"**
5. You should see "ReformDental Database Schema Created Successfully!"

---

## Step 3: Get Your Connection String

1. In your SQL Database, click **"Connection strings"** in the left menu
2. Copy the **ADO.NET** connection string
3. It looks like:
   ```
   Server=tcp:reform-dental-server.database.windows.net,1433;Initial Catalog=ReformDentalDB;Persist Security Info=False;User ID=reformdentaladmin;Password={your_password};MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;
   ```
4. **Replace `{your_password}` with your actual password!**

---

## Step 4: Deploy Azure Functions API

### Option A: Deploy via VS Code (Recommended)

1. Install the **Azure Functions** extension in VS Code
2. Open the `api` folder in VS Code
3. Press **F1** → "Azure Functions: Deploy to Function App"
4. Follow the prompts:
   - Create new Function App
   - Name: `reform-dental-api`
   - Runtime: Node.js 18
   - Region: Same as your database
5. After deployment, add Application Settings:
   - `SQL_CONNECTION_STRING`: Your connection string from Step 3

### Option B: Deploy via Azure Portal

1. Go to Azure Portal → **"+ Create a resource"**
2. Search for **"Function App"** → Create
3. Configure:
   | Setting | Value |
   |---------|-------|
   | Function App name | `reform-dental-api` |
   | Runtime stack | Node.js |
   | Version | 18 LTS |
   | Region | Same as database |
   | Plan | Consumption (Serverless) |

4. After creation:
   - Go to **Configuration** → **Application settings**
   - Add new setting:
     - Name: `SQL_CONNECTION_STRING`
     - Value: Your connection string
   - Click **Save**

5. Deploy using GitHub Actions (auto-created) or ZIP deploy

---

## Step 5: Link API to Static Web App

### 5.1 Option A: Linked Backend (Recommended)

1. Go to your Static Web App in Azure Portal
2. Click **"APIs"** in the left menu
3. Click **"Link existing"**
4. Select your Function App (`reform-dental-api`)
5. Click **"Link"**

Your API will now be available at: `https://your-static-app.azurestaticapps.net/api/`

### 5.2 Option B: Separate API URL

If you prefer to keep them separate:
1. Go to your Function App
2. Copy the URL (e.g., `https://reform-dental-api.azurewebsites.net`)
3. Update your frontend to use this URL

---

## Step 6: Update Your Frontend

Add this API configuration to your HTML file (near the top of your `<script>` section):

```javascript
// API Configuration
const API_BASE_URL = '/api'; // If using linked backend
// OR: const API_BASE_URL = 'https://reform-dental-api.azurewebsites.net/api';

// API Helper Functions
async function apiRequest(endpoint, method = 'GET', data = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
        }
    };
    
    if (data) {
        options.body = JSON.stringify(data);
    }
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    const result = await response.json();
    
    if (!result.success) {
        throw new Error(result.error || 'API request failed');
    }
    
    return result.data;
}

// Example usage:
// const users = await apiRequest('/users');
// const newUser = await apiRequest('/users', 'POST', { username: 'john', firstName: 'John' });
```

---

## API Endpoints Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login and get JWT token |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | Get all users |
| GET | `/api/users/{id}` | Get user by ID |
| POST | `/api/users` | Create new user |
| PUT | `/api/users/{id}` | Update user |
| DELETE | `/api/users/{id}` | Delete user |

### Clinics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/clinics` | Get all clinics |
| POST | `/api/clinics` | Create clinic |
| PUT | `/api/clinics/{id}` | Update clinic |
| DELETE | `/api/clinics/{id}` | Delete clinic |

### Rooms
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rooms` | Get all rooms |
| GET | `/api/rooms?clinicId={id}` | Get rooms by clinic |
| POST | `/api/rooms` | Create room |
| PUT | `/api/rooms/{id}` | Update room |
| DELETE | `/api/rooms/{id}` | Delete room |

### Schedules
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/schedules` | Get all schedules |
| GET | `/api/schedules?userId={id}` | Filter by user |
| POST | `/api/schedules` | Create schedule |
| PUT | `/api/schedules/{id}` | Update schedule |
| DELETE | `/api/schedules/{id}` | Delete schedule |

### Tasks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | Get all tasks |
| GET | `/api/tasks?status=Pending` | Filter by status |
| GET | `/api/tasks/stats/summary` | Get task statistics |
| POST | `/api/tasks` | Create task |
| PUT | `/api/tasks/{id}` | Update task |
| DELETE | `/api/tasks/{id}` | Delete task |

### Equipment
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/equipment` | Get all equipment |
| POST | `/api/equipment` | Create equipment |
| PUT | `/api/equipment/{id}` | Update equipment |
| DELETE | `/api/equipment/{id}` | Delete equipment |

### Supplies
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/supplies` | Get all supplies |
| GET | `/api/supplies?lowStock=true` | Get low stock items |
| POST | `/api/supplies` | Create supply |
| PUT | `/api/supplies/{id}` | Update supply |
| DELETE | `/api/supplies/{id}` | Delete supply |

### Instruments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/instruments` | Get all instruments |
| GET | `/api/instruments?category=diagnostic` | Filter by category |
| POST | `/api/instruments` | Create instrument |
| PUT | `/api/instruments/{id}` | Update instrument |
| DELETE | `/api/instruments/{id}` | Delete instrument |

---

## Estimated Monthly Costs

| Service | Tier | Est. Cost |
|---------|------|-----------|
| Azure SQL Database | Basic (5 DTU) | ~$5/month |
| Azure Functions | Consumption | ~$0 (free tier) |
| Azure Static Web Apps | Free | $0 |
| **Total** | | **~$5/month** |

For production, consider:
- SQL Database Standard S0: ~$15/month
- Static Web Apps Standard: ~$9/month

---

## Troubleshooting

### "Cannot connect to database"
- Check your connection string
- Ensure your IP is whitelisted in SQL firewall
- Verify the password is correct

### "CORS error"
- API functions include CORS headers
- If issues persist, add your domain to Function App CORS settings

### "Function not found"
- Ensure functions are deployed
- Check Function App logs in Azure Portal

---

## Need Help?

1. Check Azure Function logs: Portal → Function App → Functions → [function] → Monitor
2. Check SQL logs: Portal → SQL Database → Query editor
3. Test API directly: `https://your-function-app.azurewebsites.net/api/users`
