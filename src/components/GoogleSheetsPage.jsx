import React from 'react';
import { FileSpreadsheet } from 'lucide-react';
import SheetImportSection from './colis/SheetImportSection';

export default function GoogleSheetsPage({ orders = [], setOrders }) {
  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
        <FileSpreadsheet size={20} className="text-green-600" />
        <div>
          <h1 className="font-bold text-gray-800 text-base leading-tight">Google Sheets</h1>
          <p className="text-xs text-gray-400">Importer les commandes depuis une feuille exportée en CSV</p>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <SheetImportSection orders={orders} setOrders={setOrders} />
      </div>
    </div>
  );
}
