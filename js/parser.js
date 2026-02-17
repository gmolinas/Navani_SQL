// dbdiagram DSL Parser
// Supports: Table definitions, columns, types, constraints, references, indexes, notes

const DBPARSER = {
    // Parse dbdiagram DSL to internal schema
    parse: function(diagramText) {
        const tables = [];
        const relationships = [];
        
        // Remove comments
        let text = diagramText
            .replace(/\/\/.*$/gm, '')           // Remove // comments
            .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove /* */ comments
        
        // Match Table definitions (with optional [icon: fa-xxx] attribute)
        const tableRegex = /Table\s+(\w+)\s*(?:\[([^\]]*)\])?\s*\{([\s\S]*?)\}/gi;
        let tableMatch;

        while ((tableMatch = tableRegex.exec(text)) !== null) {
            const tableName = tableMatch[1];
            const tableAttrs = tableMatch[2] || '';
            const tableBody = tableMatch[3];

            // Parse table-level attributes (e.g. icon: fa-users, color: #ff0000)
            let tableIcon = null;
            let tableColor = null;
            const iconAttr = tableAttrs.match(/icon:\s*([\w-]+)/i);
            if (iconAttr) tableIcon = iconAttr[1];
            const colorAttr = tableAttrs.match(/color:\s*(#[0-9a-fA-F]{6})/i);
            if (colorAttr) tableColor = colorAttr[1];
            
            const columns = [];
            const indexes = [];
            let tableNote = '';
            
            // Split by lines
            const lines = tableBody.split('\n').map(l => l.trim()).filter(l => l);
            
            for (const line of lines) {
                // Check for Indexes section
                if (line.toLowerCase().startsWith('indexes')) continue;
                
                // Check for Note
                const noteMatch = line.match(/^note:\s*['"](.*)['"]/i);
                if (noteMatch) {
                    tableNote = noteMatch[1];
                    continue;
                }
                
                // Check for Index
                const indexMatch = line.match(/^Index(es)?\s*\{([\s\S]*?)\}/i);
                if (indexMatch) {
                    const indexContent = indexMatch[2];
                    // Single column indexes: (columnName)
                    const singleIdx = indexContent.match(/\((\w+)\)/);
                    if (singleIdx) {
                        indexes.push({ columns: [singleIdx[1]] });
                    }
                    // Composite indexes: (col1, col2) [pk] or (col1, col2)
                    const compositeIdx = indexContent.match(/\((\w+),\s*(\w+)\)/);
                    if (compositeIdx) {
                        indexes.push({ columns: [compositeIdx[1], compositeIdx[2]] });
                    }
                    continue;
                }
                
                // Parse column definition: "name type [constraints]"
                const colMatch = line.match(/^(\w+)\s+(\w+(?:\([^)]+\))?)\s*(.*)?$/i);
                if (colMatch) {
                    const colName = colMatch[1];
                    const colType = colMatch[2].toUpperCase();
                    const constraintsStr = colMatch[3] || '';
                    
                    // Parse constraints
                    const constraints = this.parseConstraints(constraintsStr);
                    
                    columns.push({
                        name: colName,
                        type: this.normalizeType(colType),
                        pk: constraints.pk,
                        increment: constraints.increment,
                        notNull: constraints.notNull,
                        unique: constraints.unique,
                        default: constraints.default,
                        fk: constraints.ref !== null,
                        refTable: constraints.ref?.table || null,
                        refColumn: constraints.ref?.column || null,
                        note: constraints.note
                    });
                    
                    // Add relationship if foreign key
                    if (constraints.ref) {
                        relationships.push({
                            fromTable: tableName,
                            fromColumn: colName,
                            toTable: constraints.ref.table,
                            toColumn: constraints.ref.column || 'id'
                        });
                    }
                }
            }
            
            tables.push({
                name: tableName,
                columns,
                indexes,
                note: tableNote,
                icon: tableIcon,
                color: tableColor,
                x: 0,
                y: 0
            });
        }
        
        return { tables, relationships };
    },
    
    // Parse column constraints from bracket notation
    parseConstraints: function(constraintsStr) {
        const result = {
            pk: false,
            increment: false,
            notNull: false,
            unique: false,
            default: null,
            ref: null,
            note: null
        };
        
        if (!constraintsStr) return result;
        
        // Remove brackets
        const constraints = constraintsStr.replace(/[\[\]]/g, '').split(',').map(c => c.trim());
        
        for (const c of constraints) {
            const lower = c.toLowerCase();
            
            if (lower === 'pk' || lower === 'primary key') {
                result.pk = true;
            } else if (lower === 'increment' || lower === 'auto_increment' || lower === 'autoincrement') {
                result.increment = true;
                result.pk = true; // increment implies pk
            } else if (lower === 'not null') {
                result.notNull = true;
            } else if (lower === 'unique') {
                result.unique = true;
            } else if (lower.startsWith('default:')) {
                result.default = c.substring(8).trim();
            } else if (lower.startsWith('ref:') || lower.startsWith('references:')) {
                // Parse ref: > Table.Column or ref: > Table
                let refStr = c.substring(c.indexOf('>') + 1).trim();
                const parts = refStr.split('.').map(p => p.trim());
                result.ref = {
                    table: parts[0],
                    column: parts[1] || 'id'
                };
                result.notNull = true;
            } else if (lower.startsWith('note:')) {
                result.note = c.substring(5).trim().replace(/['"]/g, '');
            }
        }
        
        return result;
    },
    
    // Normalize data type to common format
    normalizeType: function(type) {
        const typeMap = {
            'INT': 'int',
            'INTEGER': 'int',
            'SMALLINT': 'int',
            'BIGINT': 'int',
            'TINYINT': 'int',
            'VARCHAR': 'varchar',
            'CHAR': 'char',
            'TEXT': 'text',
            'STRING': 'varchar',
            'BOOLEAN': 'bool',
            'BOOL': 'bool',
            'DATETIME': 'datetime',
            'TIMESTAMP': 'timestamp',
            'DATE': 'date',
            'TIME': 'time',
            'DECIMAL': 'decimal',
            'NUMERIC': 'decimal',
            'FLOAT': 'float',
            'DOUBLE': 'float',
            'REAL': 'float',
            'BLOB': 'blob',
            'BINARY': 'blob',
            'JSON': 'json',
            'UUID': 'uuid'
        };
        
        // Extract base type
        const baseType = type.replace(/\([^)]+\)/, '').toUpperCase();
        const mapped = typeMap[baseType] || baseType.toLowerCase();
        
        // Add size if present
        const sizeMatch = type.match(/\((\d+)(?:,(\d+))?\)/);
        if (sizeMatch) {
            if (sizeMatch[2]) {
                return `${mapped}(${sizeMatch[1]},${sizeMatch[2]})`;
            }
            return `${mapped}(${sizeMatch[1]})`;
        }
        
        return mapped;
    },
    
    // Generate dbdiagram DSL from schema
    // options.includeStyle: whether to include icon/color attributes (default true)
    generate: function(tables, relationships, options) {
        const includeStyle = !options || options.includeStyle !== false;
        let output = '';

        for (const table of tables) {
            const attrs = [];
            if (includeStyle) {
                if (table.icon && table.icon !== 'fa-table') attrs.push(`icon: ${table.icon}`);
                if (table.color) attrs.push(`color: ${table.color}`);
            }
            if (attrs.length > 0) {
                output += `Table ${table.name} [${attrs.join(', ')}] {\n`;
            } else {
                output += `Table ${table.name} {\n`;
            }
            
            // Columns
            for (const col of table.columns) {
                let constraints = [];
                
                if (col.pk) {
                    constraints.push(col.increment ? 'increment' : 'pk');
                }
                if (col.notNull && !col.pk) {
                    constraints.push('not null');
                }
                if (col.unique && !col.pk) {
                    constraints.push('unique');
                }
                if (col.default) {
                    constraints.push(`default: ${col.default}`);
                }
                if (col.fk || col.refTable) {
                    constraints.push(`ref: > ${col.refTable || 'table'}.${col.refColumn || 'id'}`);
                }
                if (col.note) {
                    constraints.push(`note: '${col.note}'`);
                }
                
                const constraintStr = constraints.length > 0 ? ` [${constraints.join(', ')}]` : '';
                output += `  ${col.name} ${col.type}${constraintStr}\n`;
            }
            
            // Indexes
            if (table.indexes && table.indexes.length > 0) {
                output += '\n  Indexes {\n';
                for (const idx of table.indexes) {
                    output += `    (${idx.columns.join(', ')})\n`;
                }
                output += '  }\n';
            }
            
            // Table note
            if (table.note) {
                output += `\n  note: '${table.note}'\n`;
            }
            
            output += '}\n\n';
        }
        
        return output;
    },
    
    // Generate SQL CREATE TABLE from schema
    generateSQL: function(tables, relationships) {
        let sql = '';
        
        for (const table of tables) {
            sql += `CREATE TABLE ${table.name} (\n`;
            
            const columnDefs = [];
            const pks = [];
            
            for (const col of table.columns) {
                let def = `    ${col.name} ${this.sqlType(col.type)}`;
                
                if (col.increment) {
                    def += ' AUTO_INCREMENT';
                }
                if (col.notNull) {
                    def += ' NOT NULL';
                }
                if (col.unique) {
                    def += ' UNIQUE';
                }
                if (col.default) {
                    def += ` DEFAULT ${col.default}`;
                }
                
                // Check for FK
                const fkRel = relationships.find(r => r.fromTable === table.name && r.fromColumn === col.name);
                if (fkRel) {
                    def += `,\n    FOREIGN KEY (${col.name}) REFERENCES ${fkRel.toTable}(${fkRel.toColumn})`;
                }
                
                if (col.pk) {
                    pks.push(col.name);
                }
                
                columnDefs.push(def);
            }
            
            // Primary key constraint
            if (pks.length > 0) {
                columnDefs.push(`    PRIMARY KEY (${pks.join(', ')})`);
            }
            
            sql += columnDefs.join(',\n');
            sql += '\n);\n\n';
        }
        
        return sql;
    },
    
    // Convert dbdiagram type to SQL type
    sqlType: function(type) {
        const typeMap = {
            'int': 'INT',
            'varchar': 'VARCHAR',
            'text': 'TEXT',
            'bool': 'BOOLEAN',
            'datetime': 'DATETIME',
            'date': 'DATE',
            'timestamp': 'TIMESTAMP',
            'decimal': 'DECIMAL',
            'float': 'FLOAT',
            'blob': 'BLOB',
            'json': 'JSON',
            'uuid': 'VARCHAR(36)'
        };
        
        return typeMap[type.toLowerCase()] || type.toUpperCase();
    }
};

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DBPARSER;
}
