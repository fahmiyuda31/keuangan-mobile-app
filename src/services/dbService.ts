import * as SQLite from 'expo-sqlite';
import { Category, Transaction, Budget } from '@/database/models';

function toIsoString(value: Date | string): string {
  return typeof value === 'string' ? value : value.toISOString();
}

let db: SQLite.SQLiteDatabase | null = null;

function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync('keuangan.db');
    migrateDatabase(db);
  }
  return db;
}

type Migration = (database: SQLite.SQLiteDatabase) => void;

const migrations: Migration[] = [
  (database) => {
    database.execSync(`
      CREATE TABLE IF NOT EXISTS Category (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        icon TEXT NOT NULL,
        type TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
    `);
    database.execSync(`
      CREATE TABLE IF NOT EXISTS "Transaction" (
        id TEXT PRIMARY KEY NOT NULL,
        amount REAL NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        type TEXT NOT NULL,
        date TEXT NOT NULL,
        notes TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
    `);
    database.execSync(`
      CREATE TABLE IF NOT EXISTS Budget (
        id TEXT PRIMARY KEY NOT NULL,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        period TEXT NOT NULL,
        startDate TEXT NOT NULL,
        endDate TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
    `);
  },
];

function migrateDatabase(database: SQLite.SQLiteDatabase): void {
  const row = database.getFirstSync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  while (version < migrations.length) {
    const next = version + 1;
    database.execSync('BEGIN TRANSACTION');
    try {
      migrations[version](database);
      database.execSync(`PRAGMA user_version = ${next}`);
      database.execSync('COMMIT');
    } catch (error) {
      database.execSync('ROLLBACK');
      console.error(`Migration ${next} failed:`, error);
      throw error;
    }
    version = next;
  }
}

export async function closeDb(): Promise<void> {
  if (db) {
    db.closeSync();
    db = null;
  }
}

function rowToTransaction(row: any): Transaction {
  return {
    id: row.id,
    amount: row.amount,
    description: row.description,
    category: row.category,
    type: row.type as 'income' | 'expense',
    date: new Date(row.date),
    notes: row.notes ?? undefined,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

function rowToCategory(row: any): Category {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    type: row.type as 'income' | 'expense',
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

function rowToBudget(row: any): Budget {
  return {
    id: row.id,
    category: row.category,
    amount: row.amount,
    period: row.period as 'daily' | 'weekly' | 'monthly' | 'yearly',
    startDate: new Date(row.startDate),
    endDate: row.endDate ? new Date(row.endDate) : undefined,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

export async function seedDefaultCategories(): Promise<void> {
  const database = getDb();
  const count = database.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM Category');

  if (count && count.count > 0) return;

  const defaultCategories: Category[] = [
    {
      id: 'cat_salary',
      name: 'Gaji',
      color: '#4caf50',
      icon: 'cash',
      type: 'income',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'cat_bonus',
      name: 'Bonus',
      color: '#4caf50',
      icon: 'gift',
      type: 'income',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'cat_investment',
      name: 'Investasi',
      color: '#4caf50',
      icon: 'trending-up',
      type: 'income',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'cat_other_income',
      name: 'Lainnya',
      color: '#4caf50',
      icon: 'ellipsis-horizontal',
      type: 'income',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'cat_food',
      name: 'Makanan',
      color: '#ff6b6b',
      icon: 'restaurant',
      type: 'expense',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'cat_transport',
      name: 'Transportasi',
      color: '#ff6b6b',
      icon: 'car',
      type: 'expense',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'cat_entertainment',
      name: 'Hiburan',
      color: '#ff6b6b',
      icon: 'game-controller',
      type: 'expense',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'cat_utilities',
      name: 'Utilitas',
      color: '#ff6b6b',
      icon: 'flash',
      type: 'expense',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'cat_health',
      name: 'Kesehatan',
      color: '#ff6b6b',
      icon: 'medical',
      type: 'expense',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'cat_education',
      name: 'Pendidikan',
      color: '#ff6b6b',
      icon: 'school',
      type: 'expense',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'cat_shopping',
      name: 'Belanja',
      color: '#ff6b6b',
      icon: 'cart',
      type: 'expense',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'cat_other_expense',
      name: 'Lainnya',
      color: '#ff6b6b',
      icon: 'ellipsis-horizontal',
      type: 'expense',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  database.execSync(`BEGIN TRANSACTION`);
  try {
    for (const category of defaultCategories) {
      database.runSync(
        'INSERT INTO Category (id, name, color, icon, type, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          category.id,
          category.name,
          category.color,
          category.icon,
          category.type,
          toIsoString(category.createdAt),
          toIsoString(category.updatedAt),
        ]
      );
    }
    database.execSync(`COMMIT`);
  } catch (error) {
    database.execSync(`ROLLBACK`);
    console.error('Failed to seed categories:', error);
    throw error;
  }
}

export async function addTransaction(transaction: Transaction): Promise<void> {
  const database = getDb();
  database.runSync(
    'INSERT INTO "Transaction" (id, amount, description, category, type, date, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      transaction.id,
      transaction.amount,
      transaction.description,
      transaction.category,
      transaction.type,
      toIsoString(transaction.date),
      transaction.notes ?? null,
      toIsoString(transaction.createdAt),
      toIsoString(transaction.updatedAt),
    ]
  );
}

export async function getAllTransactions(): Promise<Transaction[]> {
  const database = getDb();
  const rows = database.getAllSync<any>('SELECT * FROM "Transaction" ORDER BY date DESC');
  return rows.map(rowToTransaction);
}

export async function deleteTransaction(id: string): Promise<void> {
  const database = getDb();
  database.runSync('DELETE FROM "Transaction" WHERE id = ?', [id]);
}

export async function updateTransaction(id: string, updates: Partial<Transaction>): Promise<void> {
  const database = getDb();
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.amount !== undefined) {
    fields.push('amount = ?');
    values.push(updates.amount);
  }
  if (updates.description !== undefined) {
    fields.push('description = ?');
    values.push(updates.description);
  }
  if (updates.category !== undefined) {
    fields.push('category = ?');
    values.push(updates.category);
  }
  if (updates.type !== undefined) {
    fields.push('type = ?');
    values.push(updates.type);
  }
  if (updates.date !== undefined) {
    fields.push('date = ?');
    values.push(toIsoString(updates.date));
  }
  if (updates.notes !== undefined) {
    fields.push('notes = ?');
    values.push(updates.notes);
  }
  if (updates.updatedAt !== undefined) {
    fields.push('updatedAt = ?');
    values.push(toIsoString(updates.updatedAt));
  } else {
    fields.push('updatedAt = ?');
    values.push(new Date().toISOString());
  }

  if (fields.length === 0) return;

  values.push(id);
  database.runSync(`UPDATE "Transaction" SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function addCategory(category: Category): Promise<void> {
  const database = getDb();
  database.runSync(
    'INSERT INTO Category (id, name, color, icon, type, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      category.id,
      category.name,
      category.color,
      category.icon,
      category.type,
      toIsoString(category.createdAt),
      toIsoString(category.updatedAt),
    ]
  );
}

export async function getAllCategories(): Promise<Category[]> {
  const database = getDb();
  const rows = database.getAllSync<any>('SELECT * FROM Category ORDER BY name ASC');
  return rows.map(rowToCategory);
}

export async function deleteCategory(id: string): Promise<void> {
  const database = getDb();
  database.runSync('DELETE FROM Category WHERE id = ?', [id]);
}

export async function updateCategory(id: string, updates: Partial<Category>): Promise<void> {
  const database = getDb();
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.color !== undefined) {
    fields.push('color = ?');
    values.push(updates.color);
  }
  if (updates.icon !== undefined) {
    fields.push('icon = ?');
    values.push(updates.icon);
  }
  if (updates.type !== undefined) {
    fields.push('type = ?');
    values.push(updates.type);
  }
  if (updates.updatedAt !== undefined) {
    fields.push('updatedAt = ?');
    values.push(toIsoString(updates.updatedAt));
  } else {
    fields.push('updatedAt = ?');
    values.push(new Date().toISOString());
  }

  if (fields.length === 0) return;

  values.push(id);
  database.runSync(`UPDATE Category SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function addBudget(budget: Budget): Promise<void> {
  const database = getDb();
  database.runSync(
    'INSERT INTO Budget (id, category, amount, period, startDate, endDate, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [
      budget.id,
      budget.category,
      budget.amount,
      budget.period,
      toIsoString(budget.startDate),
      budget.endDate ? toIsoString(budget.endDate) : null,
      toIsoString(budget.createdAt),
      toIsoString(budget.updatedAt),
    ]
  );
}

export async function getAllBudgets(): Promise<Budget[]> {
  const database = getDb();
  const rows = database.getAllSync<any>('SELECT * FROM Budget ORDER BY startDate DESC');
  return rows.map(rowToBudget);
}

export async function deleteBudget(id: string): Promise<void> {
  const database = getDb();
  database.runSync('DELETE FROM Budget WHERE id = ?', [id]);
}

export async function updateBudget(id: string, updates: Partial<Budget>): Promise<void> {
  const database = getDb();
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.category !== undefined) {
    fields.push('category = ?');
    values.push(updates.category);
  }
  if (updates.amount !== undefined) {
    fields.push('amount = ?');
    values.push(updates.amount);
  }
  if (updates.period !== undefined) {
    fields.push('period = ?');
    values.push(updates.period);
  }
  if (updates.startDate !== undefined) {
    fields.push('startDate = ?');
    values.push(toIsoString(updates.startDate));
  }
  if (updates.endDate !== undefined) {
    fields.push('endDate = ?');
    values.push(updates.endDate ? toIsoString(updates.endDate) : null);
  }
  if (updates.updatedAt !== undefined) {
    fields.push('updatedAt = ?');
    values.push(toIsoString(updates.updatedAt));
  } else {
    fields.push('updatedAt = ?');
    values.push(new Date().toISOString());
  }

  if (fields.length === 0) return;

  values.push(id);
  database.runSync(`UPDATE Budget SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function getFinancialSummaryContext(): Promise<string> {
  const [transactions, categories, budgets] = await Promise.all([
    getAllTransactions(),
    getAllCategories(),
    getAllBudgets(),
  ]);

  let totalIncome = 0;
  let totalExpense = 0;
  const categoryTotals: Record<string, { income: number; expense: number }> = {};

  transactions.forEach((t) => {
    if (t.type === 'income') {
      totalIncome += t.amount;
    } else {
      totalExpense += t.amount;
    }

    if (!categoryTotals[t.category]) {
      categoryTotals[t.category] = { income: 0, expense: 0 };
    }
    if (t.type === 'income') {
      categoryTotals[t.category].income += t.amount;
    } else {
      categoryTotals[t.category].expense += t.amount;
    }
  });

  const balance = totalIncome - totalExpense;

  const recentTransactions = transactions.slice(0, 15).map((t) => {
    const dateStr = new Date(t.date).toISOString().split('T')[0];
    return `- [${dateStr}] ${t.type.toUpperCase()}: ${t.description} (${t.category}) = Rp ${t.amount.toLocaleString('id-ID')}${t.notes ? ` (Catatan: ${t.notes})` : ''}`;
  });

  const categoryBreakdown = Object.entries(categoryTotals).map(([cat, val]) => {
    const parts = [];
    if (val.expense > 0) parts.push(`Pengeluaran: Rp ${val.expense.toLocaleString('id-ID')}`);
    if (val.income > 0) parts.push(`Pemasukan: Rp ${val.income.toLocaleString('id-ID')}`);
    return `- ${cat}: ${parts.join(', ')}`;
  });

  const budgetSummary = budgets.map((b) => {
    return `- Budget ${b.category} (${b.period}): Rp ${b.amount.toLocaleString('id-ID')}`;
  });

  return `=== RINGKASAN SALDO & TOTAL ===
- Total Pemasukan: Rp ${totalIncome.toLocaleString('id-ID')}
- Total Pengeluaran: Rp ${totalExpense.toLocaleString('id-ID')}
- Saldo Sisa: Rp ${balance.toLocaleString('id-ID')}
- Total Jumlah Transaksi: ${transactions.length}

=== RINGKASAN PER KATEGORI ===
${categoryBreakdown.length > 0 ? categoryBreakdown.join('\n') : 'Belum ada data kategori'}

=== ANGGARAN / BUDGET ===
${budgetSummary.length > 0 ? budgetSummary.join('\n') : 'Belum ada budget terpasang'}

=== 15 TRANSAKSI TERBARU ===
${recentTransactions.length > 0 ? recentTransactions.join('\n') : 'Belum ada transaksi'}`;
}
