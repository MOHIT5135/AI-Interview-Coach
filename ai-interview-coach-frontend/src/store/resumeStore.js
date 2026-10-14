import { create } from 'zustand';

const useResumeStore = create((set) => ({
  atsFindings: null,
  setAtsFindings: (findings) => set({ atsFindings: findings }),
  clearAtsFindings: () => set({ atsFindings: null }),
  selectedKeywords: [],
  setSelectedKeywords: (keywords) => set({ selectedKeywords: keywords }),
  toggleKeyword: (keyword) => set((state) => ({
      selectedKeywords: state.selectedKeywords.includes(keyword)
          ? state.selectedKeywords.filter(k => k !== keyword)
          : [...state.selectedKeywords, keyword]
  })),
}));

export default useResumeStore;
