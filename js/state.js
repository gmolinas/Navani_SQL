// SQL Diagram - Application State & DOM Cache

// Application State
const state = {
    tables: [],
    relationships: [],
    zoom: 1,
    panX: 0,
    panY: 0,
    selectedTables: [],
    marquee: null,
    hoveredTable: null,
    isPanning: false,
    isDraggingTable: null,
    connectionDraft: null,
    relationEditor: null,
    dragStart: { x: 0, y: 0 },
    panStart: { x: 0, y: 0 },
    showStyleAttrs: true
};

// DOM Elements cache
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const elements = {
    sqlInput: null,
    lineNumbers: null,
    syntaxHighlight: null,
    canvas: null,
    canvasContainer: null,
    relationshipsSvg: null,
    emptyState: null,
    dropZone: null,
    zoomDisplay: null,
    tableModal: null,
    modalTitle: null,
    tableNameInput: null,
    columnsContainer: null,
    toastContainer: null,
    editorPanel: null,
    resizer: null
};

// Initialize DOM references (call after DOMContentLoaded)
function initElements() {
    elements.sqlInput = $('#sqlInput');
    elements.lineNumbers = $('#lineNumbers');
    elements.canvas = $('#canvas');
    elements.canvasContainer = $('#canvasArea');
    elements.relationshipsSvg = $('#linesSvg');
    elements.emptyState = $('#emptyState');
    elements.dropZone = $('#dropZone');
    elements.zoomDisplay = $('#zoomDisplay');
    elements.tableModal = $('#tableModal');
    elements.modalTitle = $('#modalTitle');
    elements.tableNameInput = $('#tableNameInput');
    elements.columnsContainer = $('#columnsContainer');
    elements.toastContainer = $('#toastContainer');
    elements.syntaxHighlight = $('#syntaxHighlight');
    elements.schemaNameInput = $('#schemaNameInput');
    elements.editorPanel = $('.editor-panel');
    elements.resizer = $('.panel-resizer') || $('#resizer');
}
