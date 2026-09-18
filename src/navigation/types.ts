export type RootStackParamList = {
  MainTabs: undefined;
  TransactionDetail: { id: string };
  AddTransaction: undefined;
  EditTransaction: { id: string };
  CategoryDetail: { id: string };
  AddCategory: undefined;
  EditCategory: { id: string };
  BudgetDetail: { id: string };
  AddBudget: undefined;
  EditBudget: { id: string };
};

export type TabParamList = {
  Dashboard: undefined;
  Transactions: undefined;
  Categories: undefined;
  Budgets: undefined;
  AIChat: undefined;
  Settings: undefined;
};
