// SQL Diagram - Table Templates

const tableTemplates = {
    users: {
        name: 'users',
        columns: [
            { name: 'id', type: 'int', pk: true, increment: true, notNull: true },
            { name: 'username', type: 'varchar(50)', notNull: true },
            { name: 'email', type: 'varchar(100)', unique: true },
            { name: 'password', type: 'varchar(255)', notNull: true },
            { name: 'created_at', type: 'datetime' }
        ]
    },
    posts: {
        name: 'posts',
        columns: [
            { name: 'id', type: 'int', pk: true, increment: true, notNull: true },
            { name: 'user_id', type: 'int', fk: true, refTable: 'users', refColumn: 'id', notNull: true },
            { name: 'title', type: 'varchar(200)', notNull: true },
            { name: 'content', type: 'text' },
            { name: 'published', type: 'bool', default: 'false' },
            { name: 'created_at', type: 'datetime' }
        ]
    },
    orders: {
        name: 'orders',
        columns: [
            { name: 'id', type: 'int', pk: true, increment: true, notNull: true },
            { name: 'user_id', type: 'int', fk: true, refTable: 'users', refColumn: 'id', notNull: true },
            { name: 'total', type: 'decimal(10,2)', notNull: true },
            { name: 'status', type: 'varchar(20)', default: "'pending'" },
            { name: 'created_at', type: 'datetime' }
        ]
    },
    products: {
        name: 'products',
        columns: [
            { name: 'id', type: 'int', pk: true, increment: true, notNull: true },
            { name: 'name', type: 'varchar(100)', notNull: true },
            { name: 'description', type: 'text' },
            { name: 'price', type: 'decimal(10,2)', notNull: true },
            { name: 'stock', type: 'int', default: '0' },
            { name: 'created_at', type: 'datetime' }
        ]
    }
};
