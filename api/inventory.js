// Equipment, Supplies, and Instruments API Functions
const { app } = require('@azure/functions');
const { execute } = require('./shared/database');
const { successResponse, errorResponse, handleOptions } = require('./shared/response');

// ============ EQUIPMENT ============

// GET all equipment
app.http('getEquipment', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'equipment',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') return handleOptions();
        
        try {
            const clinicId = request.query.get('clinicId');
            const status = request.query.get('status');
            const category = request.query.get('category');
            
            let query = `
                SELECT e.*, c.Name AS ClinicName, r.Name AS RoomName
                FROM Equipment e
                LEFT JOIN Clinics c ON e.ClinicId = c.Id
                LEFT JOIN Rooms r ON e.RoomId = r.Id
                WHERE 1=1
            `;
            
            const params = {};
            
            if (clinicId) {
                query += ' AND e.ClinicId = @clinicId';
                params.clinicId = clinicId;
            }
            if (status) {
                query += ' AND e.Status = @status';
                params.status = status;
            }
            if (category) {
                query += ' AND e.Category = @category';
                params.category = category;
            }
            
            query += ' ORDER BY e.Name';
            
            const result = await execute(query, params);
            return successResponse(result.recordset);
        } catch (err) {
            context.error('Error fetching equipment:', err);
            return errorResponse('Failed to fetch equipment', 500);
        }
    }
});

// POST create equipment
app.http('createEquipment', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'equipment',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') return handleOptions();
        
        try {
            const body = await request.json();
            
            const result = await execute(`
                INSERT INTO Equipment (Name, Category, Brand, Model, SerialNumber, Description, 
                    ClinicId, RoomId, PurchaseDate, PurchasePrice, WarrantyExpiry, Status,
                    MaintenanceSchedule, LastMaintenanceDate, NextMaintenanceDate, VendorId, Notes, ImageUrl)
                OUTPUT INSERTED.Id
                VALUES (@name, @category, @brand, @model, @serialNumber, @description,
                    @clinicId, @roomId, @purchaseDate, @purchasePrice, @warrantyExpiry, @status,
                    @maintenanceSchedule, @lastMaintenanceDate, @nextMaintenanceDate, @vendorId, @notes, @imageUrl)
            `, {
                name: body.name,
                category: body.category || null,
                brand: body.brand || null,
                model: body.model || null,
                serialNumber: body.serialNumber || null,
                description: body.description || null,
                clinicId: body.clinicId || null,
                roomId: body.roomId || null,
                purchaseDate: body.purchaseDate || null,
                purchasePrice: body.purchasePrice || null,
                warrantyExpiry: body.warrantyExpiry || null,
                status: body.status || 'operational',
                maintenanceSchedule: body.maintenanceSchedule || null,
                lastMaintenanceDate: body.lastMaintenanceDate || null,
                nextMaintenanceDate: body.nextMaintenanceDate || null,
                vendorId: body.vendorId || null,
                notes: body.notes || null,
                imageUrl: body.imageUrl || null
            });
            
            return successResponse({ id: result.recordset[0].Id }, 201);
        } catch (err) {
            context.error('Error creating equipment:', err);
            return errorResponse('Failed to create equipment', 500);
        }
    }
});

// PUT update equipment
app.http('updateEquipment', {
    methods: ['PUT', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'equipment/{id}',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') return handleOptions();
        
        const id = request.params.id;
        
        try {
            const body = await request.json();
            
            await execute(`
                UPDATE Equipment SET
                    Name = @name, Category = @category, Brand = @brand, Model = @model,
                    SerialNumber = @serialNumber, Description = @description,
                    ClinicId = @clinicId, RoomId = @roomId, PurchaseDate = @purchaseDate,
                    PurchasePrice = @purchasePrice, WarrantyExpiry = @warrantyExpiry, Status = @status,
                    MaintenanceSchedule = @maintenanceSchedule, LastMaintenanceDate = @lastMaintenanceDate,
                    NextMaintenanceDate = @nextMaintenanceDate, VendorId = @vendorId, Notes = @notes,
                    ImageUrl = @imageUrl, ModifiedDate = GETUTCDATE()
                WHERE Id = @id
            `, {
                id: id,
                name: body.name,
                category: body.category || null,
                brand: body.brand || null,
                model: body.model || null,
                serialNumber: body.serialNumber || null,
                description: body.description || null,
                clinicId: body.clinicId || null,
                roomId: body.roomId || null,
                purchaseDate: body.purchaseDate || null,
                purchasePrice: body.purchasePrice || null,
                warrantyExpiry: body.warrantyExpiry || null,
                status: body.status || 'operational',
                maintenanceSchedule: body.maintenanceSchedule || null,
                lastMaintenanceDate: body.lastMaintenanceDate || null,
                nextMaintenanceDate: body.nextMaintenanceDate || null,
                vendorId: body.vendorId || null,
                notes: body.notes || null,
                imageUrl: body.imageUrl || null
            });
            
            return successResponse({ message: 'Equipment updated successfully' });
        } catch (err) {
            context.error('Error updating equipment:', err);
            return errorResponse('Failed to update equipment', 500);
        }
    }
});

// DELETE equipment
app.http('deleteEquipment', {
    methods: ['DELETE', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'equipment/{id}',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') return handleOptions();
        
        const id = request.params.id;
        
        try {
            await execute(`DELETE FROM Equipment WHERE Id = @id`, { id });
            return successResponse({ message: 'Equipment deleted successfully' });
        } catch (err) {
            context.error('Error deleting equipment:', err);
            return errorResponse('Failed to delete equipment', 500);
        }
    }
});

// ============ SUPPLIES ============

// GET all supplies
app.http('getSupplies', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'supplies',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') return handleOptions();
        
        try {
            const lowStock = request.query.get('lowStock');
            const category = request.query.get('category');
            
            let query = `
                SELECT s.*, c.Name AS ClinicName
                FROM Supplies s
                LEFT JOIN Clinics c ON s.ClinicId = c.Id
                WHERE s.IsActive = 1
            `;
            
            const params = {};
            
            if (lowStock === 'true') {
                query += ' AND s.QuantityInStock <= s.ReorderPoint';
            }
            if (category) {
                query += ' AND s.Category = @category';
                params.category = category;
            }
            
            query += ' ORDER BY s.Name';
            
            const result = await execute(query, params);
            return successResponse(result.recordset);
        } catch (err) {
            context.error('Error fetching supplies:', err);
            return errorResponse('Failed to fetch supplies', 500);
        }
    }
});

// POST create supply
app.http('createSupply', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'supplies',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') return handleOptions();
        
        try {
            const body = await request.json();
            
            const result = await execute(`
                INSERT INTO Supplies (Name, Category, SKU, Description, Unit, QuantityInStock,
                    MinimumStock, ReorderPoint, UnitCost, ClinicId, StorageLocation, VendorId, ExpirationDate)
                OUTPUT INSERTED.Id
                VALUES (@name, @category, @sku, @description, @unit, @quantityInStock,
                    @minimumStock, @reorderPoint, @unitCost, @clinicId, @storageLocation, @vendorId, @expirationDate)
            `, {
                name: body.name,
                category: body.category || null,
                sku: body.sku || null,
                description: body.description || null,
                unit: body.unit || 'piece',
                quantityInStock: body.quantityInStock || 0,
                minimumStock: body.minimumStock || 0,
                reorderPoint: body.reorderPoint || 0,
                unitCost: body.unitCost || null,
                clinicId: body.clinicId || null,
                storageLocation: body.storageLocation || null,
                vendorId: body.vendorId || null,
                expirationDate: body.expirationDate || null
            });
            
            return successResponse({ id: result.recordset[0].Id }, 201);
        } catch (err) {
            context.error('Error creating supply:', err);
            return errorResponse('Failed to create supply', 500);
        }
    }
});

// PUT update supply
app.http('updateSupply', {
    methods: ['PUT', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'supplies/{id}',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') return handleOptions();
        
        const id = request.params.id;
        
        try {
            const body = await request.json();
            
            await execute(`
                UPDATE Supplies SET
                    Name = @name, Category = @category, SKU = @sku, Description = @description,
                    Unit = @unit, QuantityInStock = @quantityInStock, MinimumStock = @minimumStock,
                    ReorderPoint = @reorderPoint, UnitCost = @unitCost, ClinicId = @clinicId,
                    StorageLocation = @storageLocation, VendorId = @vendorId, ExpirationDate = @expirationDate,
                    ModifiedDate = GETUTCDATE()
                WHERE Id = @id
            `, {
                id: id,
                name: body.name,
                category: body.category || null,
                sku: body.sku || null,
                description: body.description || null,
                unit: body.unit || 'piece',
                quantityInStock: body.quantityInStock || 0,
                minimumStock: body.minimumStock || 0,
                reorderPoint: body.reorderPoint || 0,
                unitCost: body.unitCost || null,
                clinicId: body.clinicId || null,
                storageLocation: body.storageLocation || null,
                vendorId: body.vendorId || null,
                expirationDate: body.expirationDate || null
            });
            
            return successResponse({ message: 'Supply updated successfully' });
        } catch (err) {
            context.error('Error updating supply:', err);
            return errorResponse('Failed to update supply', 500);
        }
    }
});

// DELETE supply (soft delete)
app.http('deleteSupply', {
    methods: ['DELETE', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'supplies/{id}',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') return handleOptions();
        
        const id = request.params.id;
        
        try {
            await execute(`UPDATE Supplies SET IsActive = 0, ModifiedDate = GETUTCDATE() WHERE Id = @id`, { id });
            return successResponse({ message: 'Supply deleted successfully' });
        } catch (err) {
            context.error('Error deleting supply:', err);
            return errorResponse('Failed to delete supply', 500);
        }
    }
});

// ============ INSTRUMENTS ============

// GET all instruments
app.http('getInstruments', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'instruments',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') return handleOptions();
        
        try {
            const category = request.query.get('category');
            const clinicId = request.query.get('clinicId');
            
            let query = `
                SELECT i.*, c.Name AS ClinicName
                FROM Instruments i
                LEFT JOIN Clinics c ON i.ClinicId = c.Id
                WHERE 1=1
            `;
            
            const params = {};
            
            if (category) {
                query += ' AND i.Category = @category';
                params.category = category;
            }
            if (clinicId) {
                query += ' AND i.ClinicId = @clinicId';
                params.clinicId = clinicId;
            }
            
            query += ' ORDER BY i.Category, i.Name';
            
            const result = await execute(query, params);
            return successResponse(result.recordset);
        } catch (err) {
            context.error('Error fetching instruments:', err);
            return errorResponse('Failed to fetch instruments', 500);
        }
    }
});

// POST create instrument
app.http('createInstrument', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'instruments',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') return handleOptions();
        
        try {
            const body = await request.json();
            
            const result = await execute(`
                INSERT INTO Instruments (Name, Category, Description, Quantity, ClinicId,
                    SterilizationRequired, Status, PurchaseDate, UnitCost, VendorId, ImageUrl, Icon)
                OUTPUT INSERTED.Id
                VALUES (@name, @category, @description, @quantity, @clinicId,
                    @sterilizationRequired, @status, @purchaseDate, @unitCost, @vendorId, @imageUrl, @icon)
            `, {
                name: body.name,
                category: body.category || 'misc',
                description: body.description || null,
                quantity: body.quantity || 1,
                clinicId: body.clinicId || null,
                sterilizationRequired: body.sterilizationRequired !== false,
                status: body.status || 'available',
                purchaseDate: body.purchaseDate || null,
                unitCost: body.unitCost || null,
                vendorId: body.vendorId || null,
                imageUrl: body.imageUrl || null,
                icon: body.icon || null
            });
            
            return successResponse({ id: result.recordset[0].Id }, 201);
        } catch (err) {
            context.error('Error creating instrument:', err);
            return errorResponse('Failed to create instrument', 500);
        }
    }
});

// PUT update instrument
app.http('updateInstrument', {
    methods: ['PUT', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'instruments/{id}',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') return handleOptions();
        
        const id = request.params.id;
        
        try {
            const body = await request.json();
            
            await execute(`
                UPDATE Instruments SET
                    Name = @name, Category = @category, Description = @description,
                    Quantity = @quantity, ClinicId = @clinicId, SterilizationRequired = @sterilizationRequired,
                    Status = @status, PurchaseDate = @purchaseDate, UnitCost = @unitCost,
                    VendorId = @vendorId, ImageUrl = @imageUrl, Icon = @icon,
                    ModifiedDate = GETUTCDATE()
                WHERE Id = @id
            `, {
                id: id,
                name: body.name,
                category: body.category || 'misc',
                description: body.description || null,
                quantity: body.quantity || 1,
                clinicId: body.clinicId || null,
                sterilizationRequired: body.sterilizationRequired !== false,
                status: body.status || 'available',
                purchaseDate: body.purchaseDate || null,
                unitCost: body.unitCost || null,
                vendorId: body.vendorId || null,
                imageUrl: body.imageUrl || null,
                icon: body.icon || null
            });
            
            return successResponse({ message: 'Instrument updated successfully' });
        } catch (err) {
            context.error('Error updating instrument:', err);
            return errorResponse('Failed to update instrument', 500);
        }
    }
});

// DELETE instrument
app.http('deleteInstrument', {
    methods: ['DELETE', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'instruments/{id}',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') return handleOptions();
        
        const id = request.params.id;
        
        try {
            await execute(`DELETE FROM Instruments WHERE Id = @id`, { id });
            return successResponse({ message: 'Instrument deleted successfully' });
        } catch (err) {
            context.error('Error deleting instrument:', err);
            return errorResponse('Failed to delete instrument', 500);
        }
    }
});
