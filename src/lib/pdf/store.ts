import { create } from 'zustand';
import type { PDFDocumentProxy } from 'pdfjs-dist';

export interface PageConfig {
  id: string;
  pageNumber: number;
  rotation: number; // 0, 90, 180, 270
  isDeleted: boolean;
}

export type ViewMode = 'reader' | 'grid';

interface PdfState {
  pdfDocument: PDFDocumentProxy | null;
  file: File | null;
  scale: number;
  currentPage: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
  
  // Editor state
  pages: PageConfig[];
  viewMode: ViewMode;
  selectedPageIds: Set<string>; // Multi-select support
  
  // Actions
  setPdfDocument: (doc: PDFDocumentProxy | null) => void;
  setFile: (file: File | null) => void;
  setScale: (scale: number) => void;
  setCurrentPage: (page: number) => void;
  setTotalPages: (pages: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Editor actions
  setViewMode: (mode: ViewMode) => void;
  setPages: (pages: PageConfig[]) => void;
  updatePage: (id: string, updates: Partial<PageConfig>) => void;
  rotatePage: (id: string) => void;
  deletePage: (id: string) => void;
  restorePage: (id: string) => void;
  reorderPages: (startIndex: number, endIndex: number) => void;
  
  // Multi-select actions
  togglePageSelection: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  deleteUnselected: () => void;
  
  reset: () => void;
  initializePages: (totalPages: number) => void;
}

export const usePdfStore = create<PdfState>((set) => ({
  pdfDocument: null,
  file: null,
  scale: 1.0,
  currentPage: 1,
  totalPages: 0,
  isLoading: false,
  error: null,
  pages: [],
  viewMode: 'reader',
  selectedPageIds: new Set<string>(),
  
  setPdfDocument: (doc) => set({ pdfDocument: doc }),
  setFile: (file) => set({ file }),
  setScale: (scale) => set({ scale }),
  setCurrentPage: (page) => set({ currentPage: page }),
  setTotalPages: (pages) => set({ totalPages: pages }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  
  setViewMode: (mode) => set({ viewMode: mode }),
  
  setPages: (pages) => set({ pages }),
  
  updatePage: (id, updates) => {
    set((state) => ({
      pages: state.pages.map((page) =>
        page.id === id ? { ...page, ...updates } : page
      ),
    }));
  },
  
  rotatePage: (id) => {
    set((state) => ({
      pages: state.pages.map((page) =>
        page.id === id
          ? { ...page, rotation: (page.rotation + 90) % 360 }
          : page
      ),
    }));
  },
  
  deletePage: (id) => {
    set((state) => ({
      pages: state.pages.map((page) =>
        page.id === id ? { ...page, isDeleted: true } : page
      ),
    }));
  },
  
  restorePage: (id) => {
    set((state) => ({
      pages: state.pages.map((page) =>
        page.id === id ? { ...page, isDeleted: false } : page
      ),
    }));
  },
  
  reorderPages: (startIndex, endIndex) => {
    set((state) => {
      // Validate indices
      if (startIndex < 0 || startIndex >= state.pages.length ||
          endIndex < 0 || endIndex >= state.pages.length) {
        console.warn('Invalid page indices for reorder:', { startIndex, endIndex, totalPages: state.pages.length });
        return state; // Return unchanged state if indices are invalid
      }
      
      const newPages = [...state.pages];
      const [removed] = newPages.splice(startIndex, 1);
      newPages.splice(endIndex, 0, removed);
      return { pages: newPages };
    });
  },
  
  togglePageSelection: (id) => {
    set((state) => {
      const newSelected = new Set(state.selectedPageIds);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      return { selectedPageIds: newSelected };
    });
  },
  
  selectAll: () => {
    set((state) => {
      const allIds = new Set(state.pages.map((p) => p.id));
      return { selectedPageIds: allIds };
    });
  },
  
  deselectAll: () => {
    set({ selectedPageIds: new Set<string>() });
  },
  
  deleteUnselected: () => {
    set((state) => {
      const selectedIds = state.selectedPageIds;
      const updatedPages = state.pages.map((page) => 
        selectedIds.has(page.id) ? page : { ...page, isDeleted: true }
      );
      return { pages: updatedPages, selectedPageIds: new Set<string>() };
    });
  },
  
  initializePages: (totalPages) => {
    const pages: PageConfig[] = Array.from({ length: totalPages }, (_, i) => ({
      id: `page-${i + 1}`,
      pageNumber: i + 1,
      rotation: 0,
      isDeleted: false,
    }));
    set({ pages });
  },
  
  reset: () => set({
    pdfDocument: null,
    file: null,
    scale: 1.0,
    currentPage: 1,
    totalPages: 0,
    isLoading: false,
    error: null,
    pages: [],
    viewMode: 'reader',
    selectedPageIds: new Set<string>(),
  }),
}));
