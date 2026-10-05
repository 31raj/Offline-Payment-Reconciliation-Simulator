import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Activity,AlertTriangle,ArrowRight,CalendarDays,CheckCircle2,ChevronRight,Clock3,Copy,Database,FileWarning,Gauge,History,Layers3,Menu,Network,Play,RefreshCw,Search,Server,ShieldCheck,Smartphone,Wifi,WifiOff,X,Zap} from 'lucide-react';
import {createTransaction,failTransaction,getLogs,getTransactions,reconcileTransaction,simulateConflict,simulateDuplicate,syncTransactions} from './api';

const initial = [
  {id:'TXN1001',amount:500,customer:'Rahul Kumar',merchant:'Campus Cafe',source:'OFFLINE',status:'RECONCILED',time:'10:42:12',serverAmount:500},
  {id:'TXN1002',amount:1299,customer:'Ankit Singh',merchant:'Tech Store',source:'OFFLINE',status:'RECONCILED',time:'10:41:02',serverAmount:1299},
  {id:'TXN1003',amount:500,customer:'Priya Sharma',merchant:'City Mart',source:'OFFLINE',status:'CONFLICT',time:'10:39:44',serverAmount:700},
  {id:'TXN1004',amount:850,customer:'Aman Verma',merchant:'Food Hub',source:'OFFLINE',status:'DUPLICATE',time:'10:37:18',serverAmount:850},
  {id:'TXN1005',amount:2200,customer:'Neha Gupta',merchant:'Book World',source:'OFFLINE',status:'FAILED',time:'10:34:11',serverAmount:null},
  {id:'TXN1006',amount:350,customer:'Ravi Das',merchant:'Campus Cafe',source:'OFFLINE',status:'QUEUED',time:'10:31:08',serverAmount:null}
].map((tx, index) => {
  const monday = new Date();
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + index);
  const [hour, minute, second] = tx.time.split(':').map(Number);
  monday.setHours(hour, minute, second, 0);
  return {...tx, timestamp: monday.toISOString()};
});

const initLogs = [
  {id:1,action:'Reconciliation',tx:'TXN1003',result:'CONFLICT',detail:'Amount mismatch: ₹500 vs ₹700',time:'10:39:47'},
  {id:2,action:'Duplicate Detection',tx:'TXN1004',result:'DUPLICATE',detail:'Same transaction reference detected',time:'10:37:22'},
  {id:3,action:'Sync',tx:'TXN1002',result:'SUCCESS',detail:'Server record matched',time:'10:41:04'}
];

const nav = [
  ['dashboard','Dashboard',Gauge],
  ['simulation-controls','Simulation Controls',Play],
  ['transactions','Transactions',Layers3],
  ['reconciliation','Reconciliation',ShieldCheck],
  ['offline-queue','Offline Queue',Database],
  ['logs','Audit Logs',History],
  ['backend-api','Backend API',Network]
];

const pageTitles = {
  dashboard: 'Dashboard / Overview',
  transactions: 'Transactions',
  reconciliation: 'Reconciliation Results',
  'offline-queue': 'Offline Queue',
  'simulation-controls': 'Simulation Controls',
  logs: 'Audit Logs',
  'backend-api': 'Backend API'
};

function transactionDate(tx){
  const raw = tx.timestamp ?? tx.createdAt ?? tx.created_at ?? tx.transactionDate ?? tx.transaction_date ?? tx.date ?? tx.time;
  if (raw == null || /^\d{1,2}:\d{2}(:\d{2})?$/.test(String(raw).trim())) return null;
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split('-').map(Number);
    const parsed = new Date(year, month - 1, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function localDateInput(date){
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getDateRange(anchor, granularity){
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  if (granularity === 'week') {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return {start, end};
  }
  if (granularity === 'month') return {start: new Date(start.getFullYear(), start.getMonth(), 1), end: new Date(start.getFullYear(), start.getMonth() + 1, 1)};
  if (granularity === 'year') return {start: new Date(start.getFullYear(), 0, 1), end: new Date(start.getFullYear() + 1, 0, 1)};
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return {start, end};
}

function makePendingBuckets(transactions, range, granularity){
  let buckets = [];
  if (granularity === 'date') {
    buckets = [{start: range.start, end: range.end, label: range.start.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}];
  } else if (granularity === 'week') {
    buckets = Array.from({length: 7}, (_, index) => {
      const start = new Date(range.start); start.setDate(start.getDate() + index);
      const end = new Date(start); end.setDate(end.getDate() + 1);
      return {start, end, label: start.toLocaleDateString(undefined, {weekday: 'short'})};
    });
  } else if (granularity === 'month') {
    const count = new Date(range.start.getFullYear(), range.start.getMonth() + 1, 0).getDate();
    buckets = Array.from({length: Math.ceil(count / 7)}, (_, index) => {
      const start = new Date(range.start); start.setDate(index * 7 + 1);
      const end = new Date(range.start); end.setDate(Math.min(index * 7 + 8, count + 1));
      return {start, end, label: `${start.getDate()}–${end.getDate() - 1}`};
    });
  } else {
    buckets = Array.from({length: 12}, (_, month) => ({
      start: new Date(range.start.getFullYear(), month, 1),
      end: new Date(range.start.getFullYear(), month + 1, 1),
      label: new Date(range.start.getFullYear(), month, 1).toLocaleDateString(undefined, {month: 'short'})
    }));
  }
  return buckets.map(bucket => {
    const matching = transactions.filter(tx => {
      const date = transactionDate(tx);
      return date && date >= bucket.start && date < bucket.end;
    });
    return {
      label: bucket.label,
      pending: matching.filter(tx => String(tx.status ?? '').toUpperCase() === 'QUEUED').length,
      processed: matching.filter(tx => ['SYNCED', 'RECONCILED', 'DUPLICATE', 'CONFLICT', 'FAILED'].includes(String(tx.status ?? '').toUpperCase())).length
    };
  });
}

function formatDateRange(range){
  const last = new Date(range.end); last.setDate(last.getDate() - 1);
  const fmt = date => date.toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'});
  return fmt(range.start) === fmt(last) ? fmt(range.start) : `${fmt(range.start)} – ${fmt(last)}`;
}

const statusMeta = {
  RECONCILED: ['bg-emerald-500/15 text-emerald-300 border-emerald-400/30', CheckCircle2],
  SUCCESS: ['bg-emerald-500/15 text-emerald-300 border-emerald-400/30', CheckCircle2],
  DUPLICATE: ['bg-amber-400/15 text-amber-300 border-amber-400/30', Copy],
  CONFLICT: ['bg-red-500/15 text-red-300 border-red-400/30', AlertTriangle],
  FAILED: ['bg-red-500/15 text-red-300 border-red-400/30', FileWarning],
  QUEUED: ['bg-slate-400/15 text-slate-200 border-slate-400/30', Clock3],
  SYNCED: ['bg-cyan-500/15 text-cyan-300 border-cyan-400/30', RefreshCw],
  PENDING: ['bg-violet-500/15 text-violet-300 border-violet-400/30', Clock3]
};

function meta(s){
  return statusMeta[s] || ['bg-slate-400/15 text-slate-200 border-slate-400/30', Clock3];
}

function Badge({status}){
  const [m, Icon] = meta(status);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${m}`}>
      <Icon size={12} />
      {status}
    </span>
  );
}

function SummaryCard({title, value, hint, icon: Icon, tone = 'sage'}){
  const tones = {
    sage: 'bg-[#0f1d1d] text-[#9be7b0] border-[#1d483d]',
    emerald: 'bg-[#0e2a24] text-[#9be7b0] border-[#1a5a4d]',
    amber: 'bg-[#2a1d0e] text-[#f7d58f] border-[#574018]',
    red: 'bg-[#2a1414] text-[#fca5a5] border-[#5a1d1d]',
    slate: 'bg-[#111b1d] text-[#d9e5ee] border-[#2b3c3f]'
  };

  return (
    <div className="rounded-2xl border border-[#1e2b2e] bg-[#0d1718] p-5 shadow-[0_12px_32px_rgba(0,0,0,0.28)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-wide text-white">{title}</p>
          <p className="mt-1 text-xs leading-5 text-[#88a09b]">{hint}</p>
          <p className="mt-4 text-3xl font-bold tracking-tight text-white">{value}</p>
        </div>
        <div className={`rounded-xl border p-3 ${tones[tone]}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function OutcomeChart({data, isBackend, rangeLabel, hasRecords}){
  const max = Math.max(...data.map(item => item.value), 1);
  const axisMax = Math.max(4, Math.ceil(max / 4) * 4);
  const plot = {left: 70, right: 740, top: 24, bottom: 250};
  const barWidth = 72;
  const slotWidth = (plot.right - plot.left) / data.length;

  return (
    <div className="w-full rounded-3xl border border-[#1d2a2e] bg-[#0d1718] p-5 shadow-[0_12px_32px_rgba(0,0,0,0.26)] sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">Reconciliation Outcomes</h3>
          <p className="mt-1 text-xs text-[#8fa3a0]">Live status split across transaction outcomes</p>
          <p className="mt-1 text-xs font-medium text-[#68746b]">{rangeLabel}</p>
        </div>
        <span className="rounded-full border border-[#20392f] bg-[#132d2a] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a2f2c2]">
          {isBackend ? 'live' : 'local data'}
        </span>
      </div>

      {hasRecords ? <div className="overflow-x-auto">
        <svg viewBox="0 0 760 330" role="img" aria-label="Reconciliation outcome transaction counts" preserveAspectRatio="xMidYMid meet" className="mx-auto h-[300px] min-w-[620px] w-full sm:h-[360px]">
          {[0, 1, 2, 3, 4].map(tick => {
            const value = axisMax - (axisMax / 4) * tick;
            const y = plot.top + ((plot.bottom - plot.top) / 4) * tick;
            return <g key={tick}><line x1={plot.left} x2={plot.right} y1={y} y2={y} stroke="#dce6dc" strokeWidth="1" /><text x={plot.left - 12} y={y + 4} textAnchor="end" fontSize="12" fill="#68746b">{Math.round(value)}</text></g>;
          })}
          <line x1={plot.left} x2={plot.left} y1={plot.top} y2={plot.bottom} stroke="#94a39a" strokeWidth="1.5" />
          <line x1={plot.left} x2={plot.right} y1={plot.bottom} y2={plot.bottom} stroke="#94a39a" strokeWidth="1.5" />
          <text x="18" y="140" transform="rotate(-90 18 140)" textAnchor="middle" fontSize="12" fontWeight="600" fill="#536057">Transaction count</text>
          <text x={(plot.left + plot.right) / 2} y="325" textAnchor="middle" fontSize="12" fontWeight="600" fill="#536057">Outcome</text>
          {data.map((item, index) => {
            const height = (item.value / axisMax) * (plot.bottom - plot.top);
            const x = plot.left + slotWidth * index + (slotWidth - barWidth) / 2;
            const y = plot.bottom - height;
            return <g key={item.label}>
              <rect x={x} y={item.value ? y : plot.bottom - 1} width={barWidth} height={item.value ? height : 1} rx="6" fill={item.color} className="transition-all duration-500" />
              <text x={x + barWidth / 2} y={Math.max(y - 9, plot.top + 12)} textAnchor="middle" fontSize="14" fontWeight="700" fill="#17211c">{item.value}</text>
              <text x={x + barWidth / 2} y={plot.bottom + 24} textAnchor="middle" fontSize="12" fontWeight="600" fill="#536057">{item.label}</text>
            </g>;
          })}
        </svg>
      </div> : <div className="flex h-56 items-center justify-center rounded-2xl border border-dashed border-[#dce6dc] bg-[#f7faf6] px-4 text-center text-sm text-[#68746b]">No transactions found for this date range.</div>}
    </div>
  );
}

function PendingQueueChart({data, rangeLabel, hasRecords}){
  const max = Math.max(4, ...data.flatMap(item => [item.pending, item.processed]));
  const axisMax = Math.max(4, Math.ceil(max / 4) * 4);
  const plot = {left: 70, right: 740, top: 24, bottom: 250};
  const xFor = index => data.length === 1 ? (plot.left + plot.right) / 2 : plot.left + (index / (data.length - 1)) * (plot.right - plot.left);
  const yFor = value => plot.bottom - (value / axisMax) * (plot.bottom - plot.top);
  const pendingPoints = data.map((item, index) => `${xFor(index)},${yFor(item.pending)}`).join(' ');
  const processedPoints = data.map((item, index) => `${xFor(index)},${yFor(item.processed)}`).join(' ');

  return (
    <div className="w-full rounded-3xl border border-[#1d2a2e] bg-[#0d1718] p-5 shadow-[0_12px_32px_rgba(0,0,0,0.26)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">Pending Sync Activity</h3>
          <p className="mt-1 text-xs text-[#8fa3a0]">Waiting in the offline queue and processed after sync, grouped by time</p>
          <p className="mt-1 text-xs font-medium text-[#68746b]">{rangeLabel}</p>
        </div>
        <span className="rounded-full border border-[#20392f] bg-[#132d2a] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a2f2c2]">
          queue
        </span>
      </div>

      {hasRecords ? <div className="overflow-x-auto rounded-2xl border border-[#1c2c2c] bg-[#f4f7f1] p-2 sm:p-4">
        <svg viewBox="0 0 760 330" role="img" aria-label="Pending and processed transactions over time" preserveAspectRatio="xMidYMid meet" className="mx-auto h-[300px] min-w-[620px] w-full sm:h-[360px]">
          {[0, 1, 2, 3, 4].map(tick => {
            const value = axisMax - (axisMax / 4) * tick;
            const y = plot.top + ((plot.bottom - plot.top) / 4) * tick;
            return <g key={tick}><line x1={plot.left} x2={plot.right} y1={y} y2={y} stroke="#dce6dc" strokeWidth="1" /><text x={plot.left - 12} y={y + 4} textAnchor="end" fontSize="12" fill="#68746b">{Math.round(value)}</text></g>;
          })}
          <line x1={plot.left} x2={plot.left} y1={plot.top} y2={plot.bottom} stroke="#94a39a" strokeWidth="1.5" />
          <line x1={plot.left} x2={plot.right} y1={plot.bottom} y2={plot.bottom} stroke="#94a39a" strokeWidth="1.5" />
          <text x="18" y="140" transform="rotate(-90 18 140)" textAnchor="middle" fontSize="12" fontWeight="600" fill="#536057">Transaction count</text>
          <text x={(plot.left + plot.right) / 2} y="325" textAnchor="middle" fontSize="12" fontWeight="600" fill="#536057">Time</text>
          <polyline fill="none" stroke="#10a85a" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" points={pendingPoints} />
          <polyline fill="none" stroke="#4386c6" strokeWidth="3" strokeDasharray="8 6" strokeLinejoin="round" strokeLinecap="round" points={processedPoints} />
          {data.map((item, index) => <g key={item.label}>
            <circle cx={xFor(index)} cy={yFor(item.pending)} r="5" fill="#10a85a" stroke="#fff" strokeWidth="2"><title>{`${item.label}: ${item.pending} waiting`}</title></circle>
            <circle cx={xFor(index)} cy={yFor(item.processed)} r="5" fill="#4386c6" stroke="#fff" strokeWidth="2"><title>{`${item.label}: ${item.processed} processed`}</title></circle>
            <text x={xFor(index)} y={plot.bottom + 23} textAnchor="middle" fontSize="11" fontWeight="600" fill="#536057">{item.label}</text>
          </g>)}
        </svg>
      </div> : <div className="flex h-56 items-center justify-center rounded-2xl border border-dashed border-[#dce6dc] bg-[#f7faf6] px-4 text-center text-sm text-[#68746b]">No transactions found for this date range.</div>}
      {hasRecords && <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-[#536057]">
        <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-[#10a85a]" />Waiting to sync (offline queue)</span>
        <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-[#4386c6]" />Processed after sync / reconciliation</span>
      </div>}
    </div>
  );
}

function Pipeline({online, q}){
  const steps = [
    {label: 'Offline', icon: Smartphone, description: 'A payment is created while the payment network is disconnected.'},
    {label: 'Queue', icon: Database, description: 'The payment waits until the connection returns.'},
    {label: 'Sync', icon: RefreshCw, description: 'The app sends waiting payments to the backend.'},
    {label: 'Verify', icon: ShieldCheck, description: 'The system checks the payment details.'},
    {label: 'Match', icon: Network, description: 'The system compares it with existing records to find matches or duplicates.'},
    {label: 'Reconcile', icon: CheckCircle2, description: 'The system records the final payment result.'}
  ];

  return (
    <div className="rounded-3xl border border-[#1d2a2e] bg-[#0d1718] p-5 shadow-[0_12px_32px_rgba(0,0,0,0.26)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Reconciliation Health</h2>
          <p className="mt-1 text-xs text-[#8fa3a0]">Offline → Queue → Sync → Verify → Match → Reconcile</p>
        </div>
        <span className="rounded-full border border-[#1f433b] bg-[#112d28] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#a2f2c2]">
          {q} queued
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 xl:gap-2">
        {steps.map(({label, icon: Icon, description}, index) => (
          <div
            key={label}
            className={`relative flex min-w-0 flex-col rounded-2xl border p-3 ${index === 0 && !online ? 'border-[#4a3a18] bg-[#2a1d0e]' : 'border-[#1f2c2f] bg-[#101b1d]'}`}
          >
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#21383d] bg-[#0f1a1d] text-[#a2f2c2]">
                <Icon size={17} />
              </div>
              <p className="min-w-0 text-sm font-semibold text-white">{label}</p>
            </div>
            <p className="mt-3 min-h-[3.5rem] text-xs leading-5 text-[#8fa3a0]">{description}</p>
            <p className="mt-2 border-t border-[#1f2c2f] pt-2 text-[10px] font-medium text-[#8fa3a0]">
              {index === 0 ? (online ? 'Network ready' : 'Connectivity lost') : index === 1 ? `${q} waiting` : 'Engine active'}
            </p>
            {index < steps.length - 1 && <ArrowRight aria-hidden="true" className="absolute -right-[13px] top-1/2 z-10 hidden -translate-y-1/2 text-[#5a7a74] xl:block" size={16} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function Table({rows, onSelect}){
  return (
    <div className="overflow-hidden rounded-3xl border border-[#1d2a2e] bg-[#0d1718] shadow-[0_12px_32px_rgba(0,0,0,0.26)]">
      <div className="flex flex-col gap-3 border-b border-[#1c2b2d] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Transaction Ledger</h2>
          <p className="mt-1 text-xs text-[#8fa3a0]">Offline and synchronized payment records</p>
        </div>
        <span className="rounded-full border border-[#20392f] bg-[#132d2a] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a2f2c2]">
          {rows.length} records
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left">
          <thead className="bg-[#111d1d] text-[10px] uppercase tracking-[0.18em] text-[#9cadab]">
            <tr>
              {['Transaction','Customer / Merchant','Amount','Source','Status','Time',''].map((header, index) => (
                <th key={index} className="px-4 py-3 font-medium">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1c2b2d]">
            {rows.map(tx => (
              <tr key={tx.id} onClick={() => onSelect(tx)} className="group cursor-pointer hover:bg-[#eaf3e9] focus-within:bg-[#eaf3e9]">
                <td className="px-4 py-4 font-mono text-[12px] font-semibold text-white">{tx.id}</td>
                <td className="px-4 py-4">
                  <p className="text-sm font-medium text-[#edf8ff]">{tx.customer}</p>
                  <p className="mt-0.5 text-[10px] text-[#90a7a2]">{tx.merchant}</p>
                </td>
                <td className="px-4 py-4 text-sm font-bold text-[#f2fbff]">₹{Number(tx.amount).toLocaleString('en-IN')}</td>
                <td className="px-4 py-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9be7b0]">{tx.source || 'OFFLINE'}</td>
                <td className="px-4 py-4"><Badge status={tx.status} /></td>
                <td className="px-4 py-4 font-mono text-[10px] text-[#aabdb9]">{tx.time || '—'}</td>
                <td className="px-4 py-4 text-right">
                  <button aria-label={`View transaction ${tx.id}`} onClick={event => { event.stopPropagation(); onSelect(tx); }} className="rounded-xl border border-[#dbe5db] bg-white p-2 text-[#16803a] transition hover:border-[#78bd8b] hover:bg-[#f1f8f0] focus:outline-none focus:ring-2 focus:ring-emerald-600">
                    <ChevronRight size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <div className="p-10 text-center text-sm text-[#8ea4a1]">No transactions found.</div>}
      </div>
    </div>
  );
}

function Drawer({tx, close, reconcile, fail}){
  if (!tx) return null;

  return (
    <div className="transaction-drawer-backdrop fixed inset-0 z-50 flex justify-end" onMouseDown={close}>
      <aside className="transaction-drawer h-full w-full max-w-md overflow-y-auto border-l p-6 shadow-2xl slide-in" onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#8ea4a1]">Transaction Detail</p>
            <h2 className="mt-1 font-mono text-lg font-bold text-white">{tx.id}</h2>
          </div>
          <button onClick={close} className="rounded-xl border border-[#1d2f31] bg-[#101b1d] p-2 text-[#cfeef0] hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-[#1d2f31] bg-[#111d1d] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-[#8ea4a1]">Transaction amount</p>
              <p className="mt-1 text-3xl font-bold text-white">₹{Number(tx.amount).toLocaleString('en-IN')}</p>
            </div>
            <Badge status={tx.status} />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <Info l="Customer" v={tx.customer} />
            <Info l="Merchant" v={tx.merchant} />
            <Info l="Source" v={tx.source || 'OFFLINE'} />
            <Info l="Created" v={tx.time || '—'} />
          </div>
        </div>

        {tx.status === 'CONFLICT' && (
          <div className="mt-4 rounded-2xl border border-red-500/25 bg-[#2a1414] p-5">
            <div className="flex items-center gap-2 text-red-300">
              <AlertTriangle size={16} />
              <p className="text-sm font-semibold">Conflict detected</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Compare l="Offline record" v={`₹${tx.amount}`} />
              <Compare l="Server record" v={`₹${tx.serverAmount ?? '—'}`} />
            </div>
            <p className="mt-3 text-xs leading-5 text-red-200/80">
              Same transaction reference exists on the server, but the amount does not match.
            </p>
          </div>
        )}

        {tx.status === 'DUPLICATE' && (
          <div className="mt-4 rounded-2xl border border-amber-500/25 bg-[#2a1d0e] p-5">
            <div className="flex items-center gap-2 text-amber-300">
              <Copy size={16} />
              <p className="text-sm font-semibold">Duplicate transaction</p>
            </div>
            <p className="mt-2 text-xs leading-5 text-amber-200/80">
              Existing server record found with the same transaction reference.
            </p>
          </div>
        )}

        <div className="mt-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#8ea4a1]">Event timeline</p>
          <div className="mt-3 space-y-3">
            {[
              ['Transaction created', 'Offline device stored local record', '10:31:08', true],
              ['Queued', 'Waiting for connectivity', '10:31:09', true],
              ['Synchronization', tx.status === 'QUEUED' ? 'Waiting for network' : 'Sync attempt completed', '10:41:04', tx.status !== 'QUEUED'],
              ['Reconciliation', tx.status === 'QUEUED' ? 'Not started' : `${tx.status} result generated`, '10:41:05', tx.status !== 'QUEUED']
            ].map(([title, detail, time, done], index) => (
              <div className="flex gap-3" key={title}>
                <div className="flex flex-col items-center">
                  <div className={`mt-0.5 h-2.5 w-2.5 rounded-full ${done ? 'bg-[#7ef7b5]' : 'bg-[#314348]'}`} />
                  {index < 3 && <div className="mt-1 h-8 w-px bg-[#2a3a3d]" />}
                </div>
                <div className="-mt-1 flex-1">
                  <div className="flex justify-between gap-3">
                    <p className="text-xs font-medium text-[#edf8ff]">{title}</p>
                    <p className="font-mono text-[9px] text-[#93a7a3]">{time}</p>
                  </div>
                  <p className="mt-0.5 text-[10px] text-[#8fa3a0]">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {(tx.status === 'QUEUED' || tx.status === 'SYNCED') && (
          <div className="mt-6 grid grid-cols-2 gap-2">
            <button onClick={() => reconcile(tx)} className="rounded-xl bg-[#7ef7b5] px-4 py-3 text-xs font-semibold text-[#071611] shadow-[0_8px_16px_rgba(126,247,181,0.28)] hover:bg-[#97f9c7]">
              Reconcile
            </button>
            <button onClick={() => fail(tx)} className="rounded-xl border border-red-500/30 bg-[#2a1414] px-4 py-3 text-xs font-semibold text-red-200 hover:bg-[#3d1d1d]">
              Mark Failed
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

function Info({l, v}){
  return (
    <div className="rounded-xl border border-[#1d2f31] bg-[#111d1d] p-3">
      <p className="text-[9px] uppercase tracking-[0.18em] text-[#8ea4a1]">{l}</p>
      <p className="mt-1 truncate text-xs font-medium text-[#edf8ff]">{v}</p>
    </div>
  );
}

function Compare({l, v}){
  return (
    <div className="rounded-xl border border-red-500/25 bg-[#171615] p-3">
      <p className="text-[9px] uppercase tracking-[0.18em] text-[#a6b7b5]">{l}</p>
      <p className="mt-1 text-lg font-bold text-white">{v}</p>
    </div>
  );
}

function SimulationControls({online, loading, lastSync, rows, createTx, duplicate, conflict, toggleOnline, sync, inspect, queueStatus}){
  return (
    <section className="rounded-3xl border border-[#1d2a2e] bg-[#0d1718] p-5 shadow-[0_12px_32px_rgba(0,0,0,0.26)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Simulation Controls</h3>
          <p className="mt-1 text-sm text-[#8fa3a0]">Queue, sync, and reconcile payment events</p>
        </div>
        <div className="rounded-full border border-[#1f433b] bg-[#132d2a] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#a2f2c2]">
          Last sync {lastSync}
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {[
          {name: 'Create Tx', description: 'Add a sample payment transaction.', icon: Play, action: createTx, primary: true},
          {name: 'Duplicate', description: 'Create a transaction that tests duplicate detection.', icon: Copy, action: duplicate, tone: 'amber'},
          {name: 'Conflict', description: 'Create a transaction with mismatched details for review.', icon: AlertTriangle, action: conflict, tone: 'red'},
          {name: online ? 'Go Offline' : 'Go Online', description: 'Simulate the payment network disconnecting.', icon: online ? WifiOff : Wifi, action: toggleOnline, tone: online ? 'amber' : 'green'},
          {name: 'Sync Queue', description: 'Process pending transactions after reconnection.', icon: RefreshCw, action: sync, disabled: !online || loading},
          {name: 'Inspect', description: 'View transaction matching and reconciliation details.', icon: Server, action: inspect, disabled: !rows.length},
          {name: 'Queue Status', description: 'Check which transactions are waiting to sync.', icon: Database, action: queueStatus}
        ].map(({name, description, icon: Icon, action, primary, tone, disabled}, index) => (
          <div key={name} className="flex min-w-0 flex-col gap-3 rounded-2xl border border-[#1d2a2e] bg-[#101b1d] p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4">
            <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#1f433b] bg-[#132d2a] text-xs font-bold text-[#a2f2c2]">{index + 1}</span>
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-semibold text-[#edf8ff]">{name}</h4>
              <p className="mt-0.5 text-xs leading-5 text-[#8fa3a0]">{description}</p>
            </div>
            <button onClick={action} disabled={disabled} className={`inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${primary ? 'border-transparent bg-[#7ef7b5] text-[#061811] hover:bg-[#9af9c8]' : tone === 'amber' ? 'border-[#4a3a18] bg-[#2a1d0e] text-[#f7d58f] hover:bg-[#382a15]' : tone === 'red' ? 'border-[#5a1d1d] bg-[#2a1414] text-[#fca5a5] hover:bg-[#3a1919]' : tone === 'green' ? 'border-[#1f433b] bg-[#112d28] text-[#a2f2c2] hover:bg-[#153b34]' : 'border-[#1d2a2e] bg-[#0f1a1d] text-[#edf8ff] hover:bg-[#132426]'}`}>
              <Icon size={15} className={name === 'Sync Queue' && loading ? 'animate-spin' : ''} />{name}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function App(){
  const [active, setActive] = useState('dashboard');
  const [online, setOnline] = useState(true);
  const [rows, setRows] = useState(initial);
  const [logs, setLogs] = useState(initLogs);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);
  const [networkPopup, setNetworkPopup] = useState(null);
  const networkPopupTimer = useRef(null);
  const popupSequence = useRef(0);
  const [loading, setLoading] = useState(false);
  const [useBackend, setUseBackend] = useState(true);
  const [lastSync, setLastSync] = useState('Just now');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const sidebarRef = useRef(null);
  const [backendConnected, setBackendConnected] = useState(false);
  const [chartGranularity, setChartGranularity] = useState('week');
  const [chartAnchor, setChartAnchor] = useState(() => localDateInput(new Date()));

  useEffect(() => {
    const resetSidebar = () => {
      setSidebarHovered(false);
      setSidebarOpen(false);
      const focusedElement = document.activeElement;
      if (sidebarRef.current?.contains(focusedElement)) focusedElement.blur();
    };
    const handleResize = () => {
      setSidebarHovered(false);
      if (window.innerWidth >= 1024) setSidebarOpen(false);
      if (window.innerWidth < 1024) {
        const focusedElement = document.activeElement;
        if (sidebarRef.current?.contains(focusedElement)) focusedElement.blur();
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') resetSidebar();
    };

    window.addEventListener('blur', resetSidebar);
    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('blur', resetSidebar);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const sidebarExpanded = sidebarOpen || sidebarHovered;

  const stats = useMemo(() => {
    const hasStatus = status => rows.filter(tx => String(tx.status ?? '').toUpperCase() === status).length;
    return {
      total: rows.length,
      reconciled: hasStatus('RECONCILED'),
      duplicate: hasStatus('DUPLICATE'),
      conflict: hasStatus('CONFLICT'),
      failed: hasStatus('FAILED'),
      queued: rows.filter(tx => ['QUEUED', 'SYNCED'].includes(String(tx.status ?? '').toUpperCase())).length
    };
  }, [rows]);

  const chartRange = useMemo(() => {
    const [year, month, day] = chartAnchor.split('-').map(Number);
    return getDateRange(new Date(year, month - 1, day), chartGranularity);
  }, [chartAnchor, chartGranularity]);
  const chartRangeLabel = useMemo(() => formatDateRange(chartRange), [chartRange]);
  const chartRows = useMemo(() => rows.filter(tx => {
    const date = transactionDate(tx);
    return date && date >= chartRange.start && date < chartRange.end;
  }), [rows, chartRange]);
  const outcomeData = useMemo(() => {
    const count = status => chartRows.filter(tx => String(tx.status ?? '').toUpperCase() === status).length;
    return [
      {label: 'Reconciled', value: count('RECONCILED'), color: '#10B981'},
      {label: 'Duplicate', value: count('DUPLICATE'), color: '#f7d58f'},
      {label: 'Conflict', value: count('CONFLICT'), color: '#fca5a5'},
      {label: 'Failed', value: count('FAILED'), color: '#f87171'}
    ];
  }, [chartRows]);
  const pendingChartData = useMemo(() => makePendingBuckets(chartRows, chartRange, chartGranularity), [chartRows, chartRange, chartGranularity]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return q ? rows.filter(x => [x.id, x.customer, x.merchant, x.status].some(v => String(v ?? '').toLowerCase().includes(q))) : rows;
  }, [rows, search]);

  useEffect(() => {
    async function load(){
      if (!useBackend) {
        setBackendConnected(false);
        return;
      }
      try {
        const [transactions, auditLogs] = await Promise.all([getTransactions(), getLogs()]);
        if (Array.isArray(transactions)) setRows(transactions);
        if (Array.isArray(auditLogs)) setLogs(auditLogs);
        setBackendConnected(true);
      } catch (error) {
        setBackendConnected(false);
        // Keep local simulator fallback when backend is unavailable.
      }
    }

    load();
  }, [useBackend]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => () => clearTimeout(networkPopupTimer.current), []);

  const dismissNetworkPopup = () => {
    clearTimeout(networkPopupTimer.current);
    setNetworkPopup(current => current ? {...current, closing: true} : null);
    networkPopupTimer.current = setTimeout(() => setNetworkPopup(null), 220);
  };

  const showStatusPopup = popup => {
    const popupId = ++popupSequence.current;
    clearTimeout(networkPopupTimer.current);
    setNetworkPopup({id: popupId, ...popup, closing: false});
    networkPopupTimer.current = setTimeout(() => {
      setNetworkPopup(current => current?.id === popupId ? {...current, closing: true} : current);
      networkPopupTimer.current = setTimeout(() => setNetworkPopup(current => current?.id === popupId ? null : current), 220);
    }, 3400);
  };

  const toggleSimulatorNetwork = () => {
    const nextOnline = !online;
    setOnline(nextOnline);
    showStatusPopup({kind: 'network', online: nextOnline});
  };

  const notify = (message, type = 'success') => setToast({message, type});

  const refresh = async () => {
    setLoading(true);
    try {
      const [transactions, auditLogs] = await Promise.all([getTransactions(), getLogs()]);
      if (Array.isArray(transactions)) setRows(transactions);
      if (Array.isArray(auditLogs)) setLogs(auditLogs);
      setBackendConnected(true);
      setLastSync(new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}));
      notify('Dashboard refreshed from backend');
    } catch (error) {
      setBackendConnected(false);
      notify('Backend unavailable — demo data active', 'warning');
    } finally {
      setLoading(false);
    }
  };

  const createTx = async () => {
    const id = `TXN${String(Date.now()).slice(-6)}`;
    const amount = [250, 350, 499, 750, 1299, 2200][Math.floor(Math.random() * 6)];
    const tx = {
      id,
      amount,
      customer: ['Rahul Kumar', 'Priya Sharma', 'Aman Verma', 'Neha Gupta'][Math.floor(Math.random() * 4)],
      merchant: ['Campus Cafe', 'City Mart', 'Food Hub', 'Tech Store'][Math.floor(Math.random() * 4)],
      source: 'OFFLINE',
      status: online ? 'SYNCED' : 'QUEUED',
      timestamp: new Date().toISOString(),
      time: new Date().toLocaleTimeString([], {hour12: false}),
      serverAmount: amount
    };

    if (useBackend) {
      try {
        const created = await createTransaction({
          transactionId: id,
          customerId: tx.customer,
          merchantId: tx.merchant,
          amount,
          source: 'OFFLINE'
        });
        setRows(prev => [created, ...prev]);
        if (online) {
          showStatusPopup({kind: 'payment-success', message: 'Your demo transaction was created successfully.', transactionId: created.transactionId || id});
        } else {
          showStatusPopup({kind: 'payment-hold'});
        }
        return;
      } catch (error) {
        // Fall through to the local simulator.
      }
    }

    setRows(prev => [tx, ...prev]);
    if (!online) {
      showStatusPopup({kind: 'payment-hold'});
      return;
    }
    showStatusPopup({kind: 'payment-success', message: 'Your demo transaction was created successfully.', transactionId: id});
  };

  const duplicate = async () => {
    const base = rows.find(x => ['RECONCILED', 'SYNCED'].includes(String(x.status).toUpperCase())) || rows[0];
    if (!base) {
      notify('No transaction available for duplicate test', 'warning');
      return;
    }

    if (useBackend && backendConnected) {
      try {
        await simulateDuplicate(base.transactionId || base.id);
        await refresh();
        notify(`Duplicate detected for ${base.transactionId || base.id}`, 'warning');
        return;
      } catch (error) {
        console.error(error);
        notify('Backend duplicate simulation failed', 'error');
      }
    }

    const duplicateTx = {
      ...base,
      id: `DUP-${base.id}-${Date.now().toString().slice(-3)}`,
      status: 'DUPLICATE',
      timestamp: new Date().toISOString(),
      time: new Date().toLocaleTimeString([], {hour12: false})
    };

    setRows(prev => [duplicateTx, ...prev]);
    setLogs(prev => [{
      id: Date.now(),
      action: 'Duplicate Detection',
      tx: duplicateTx.id,
      result: 'DUPLICATE',
      detail: 'Existing transaction reference detected',
      time: duplicateTx.time
    }, ...prev]);
    notify('Duplicate scenario simulated', 'warning');
  };

  const conflict = async () => {
    const base = rows.find(x => ['SYNCED', 'QUEUED', 'RECONCILED'].includes(String(x.status).toUpperCase())) || rows[0];
    if (!base) {
      notify('No transaction available for conflict test', 'warning');
      return;
    }

    if (useBackend && backendConnected) {
      try {
        const result = await simulateConflict(base.transactionId || base.id);
        const serverAmount = Number(result.amount ?? base.amount) + 200;
        setRows(prev => prev.map(x => x.id === base.id ? {...x, ...result, serverAmount} : x));
        await refresh();
        notify(`Conflict detected for ${base.transactionId || base.id}`, 'warning');
        return;
      } catch (error) {
        console.error(error);
        notify('Backend conflict simulation failed', 'error');
      }
    }

    const conflictTx = {
      ...base,
      id: `CON-${Date.now().toString().slice(-6)}`,
      amount: 500,
      serverAmount: 700,
      status: 'CONFLICT',
      timestamp: new Date().toISOString(),
      time: new Date().toLocaleTimeString([], {hour12: false})
    };

    setRows(prev => [conflictTx, ...prev]);
    setLogs(prev => [{
      id: Date.now(),
      action: 'Reconciliation',
      tx: conflictTx.id,
      result: 'CONFLICT',
      detail: 'Amount mismatch: ₹500 vs ₹700',
      time: conflictTx.time
    }, ...prev]);
    notify('Conflict scenario simulated', 'warning');
  };

  const sync = async () => {
    if (!online) {
      notify('Go Online first to synchronize', 'warning');
      return;
    }

    setLoading(true);
    if (useBackend) {
      try {
        const result = await syncTransactions();
        notify(result?.message || 'Synchronization completed');
        await refresh();
        setLoading(false);
        return;
      } catch (error) {
        // Fall through to the local simulator.
      }
    }

    await new Promise(resolve => setTimeout(resolve, 700));
    setRows(prev => prev.map(x => x.status === 'QUEUED' ? {...x, status: 'RECONCILED', serverAmount: x.amount} : x));
    setLogs(prev => [{
      id: Date.now(),
      action: 'Sync',
      tx: 'BATCH',
      result: 'SUCCESS',
      detail: 'Queued records synchronized',
      time: new Date().toLocaleTimeString([], {hour12: false})
    }, ...prev]);
    setLastSync(new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}));
    notify('Queued transactions synchronized');
    setLoading(false);
  };

  const reconcile = async tx => {
    if (!online) {
      showStatusPopup({kind: 'payment-sync-failed'});
      return;
    }

    if (useBackend) {
      try {
        const result = await reconcileTransaction(tx.transactionId || tx.id, {
          transactionId: tx.transactionId || tx.id,
          customerId: tx.customerId || tx.customer,
          merchantId: tx.merchantId || tx.merchant,
          amount: tx.serverAmount ?? tx.amount
        });
        setRows(prev => prev.map(x => x.id === tx.id ? {...x, ...result} : x));
        showStatusPopup({kind: 'payment-success'});
        return;
      } catch (error) {
        // Fall through to the local simulator.
      }
    }

    setRows(prev => prev.map(x => x.id === tx.id ? {...x, status: 'RECONCILED', serverAmount: x.amount} : x));
    setLogs(prev => [{
      id: Date.now(),
      action: 'Reconciliation',
      tx: tx.id,
      result: 'RECONCILED',
      detail: 'Offline and server records matched',
      time: new Date().toLocaleTimeString([], {hour12: false})
    }, ...prev]);
    showStatusPopup({kind: 'payment-success'});
    setSelected({...tx, status: 'RECONCILED', serverAmount: tx.amount});
  };

  const fail = async tx => {
    if (useBackend) {
      try {
        await failTransaction(tx.transactionId || tx.id, 'Manual simulation failure');
        notify(`${tx.id} marked as failed`);
        await refresh();
        return;
      } catch (error) {
        // Fall through to the local simulator.
      }
    }

    setRows(prev => prev.map(x => x.id === tx.id ? {...x, status: 'FAILED'} : x));
    notify(`${tx.id} marked as failed`, 'warning');
  };

  return (
    <div className="min-h-screen bg-[#050a0d] text-[#edf8ff]">
      <div className={`dashboard-shell relative flex min-h-screen w-full ${sidebarExpanded ? 'sidebar-expanded' : ''}`}>
        <button
          type="button"
          aria-label={sidebarOpen ? 'Close navigation sidebar' : 'Open navigation sidebar'}
          aria-expanded={sidebarOpen}
          aria-controls="dashboard-sidebar"
          onClick={() => setSidebarOpen(open => !open)}
          className="sidebar-toggle fixed left-4 top-4 z-50 flex h-11 w-11 items-center justify-center rounded-xl border border-[#314238] bg-[#17211c] text-white shadow-lg lg:hidden"
        >
          <Menu size={20} />
        </button>
        <aside
          id="dashboard-sidebar"
          ref={sidebarRef}
          tabIndex={0}
          aria-label="OfflinePay navigation"
          onPointerEnter={event => {
            if (event.pointerType !== 'touch' && window.innerWidth >= 1024) setSidebarHovered(true);
          }}
          onPointerLeave={() => {
            setSidebarHovered(false);
            const focusedElement = document.activeElement;
            if (sidebarRef.current?.contains(focusedElement)) focusedElement.blur();
          }}
          className={`dashboard-sidebar min-h-screen shrink-0 flex-col border-r border-[#1d2a2e] bg-[#0c1517] px-4 py-5 ${sidebarExpanded ? 'is-expanded' : ''}`}
        >
          <div className="mb-6 flex items-center gap-3 px-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#112d28] text-[#9be7b0]">
              <Zap size={18} />
            </div>
            <div className="sidebar-copy sidebar-brand-copy">
              <h1 className="sidebar-brand-name text-lg font-bold">OfflinePay</h1>
              <p className="text-[9px] uppercase tracking-[0.22em] text-[#8fa3a0]">Simulator</p>
            </div>
          </div>

          <div className="sidebar-copy mb-4 px-2 text-[9px] font-semibold uppercase tracking-[0.22em] text-[#90a7a2]">Control Center</div>

          <nav className="sidebar-navigation space-y-1">
            {nav.map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setActive(id)}
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-medium transition ${active === id ? 'bg-[#b8f542] text-[#122015] shadow-[0_8px_18px_rgba(184,245,66,0.2)]' : 'text-[#d3e7e6] hover:bg-white/10'}`}
              >
                <Icon size={16} />
                <span className="sidebar-copy">{label}</span>
              </button>
            ))}
          </nav>

          <div className="sidebar-details mt-6 rounded-2xl border border-[#1d2a2e] bg-[#0d1718] p-3 shadow-[0_8px_20px_rgba(0,0,0,0.14)]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.18em] text-[#8ea4a1]">Network</span>
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${online ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-300'}`}>
                {online ? 'Online' : 'Offline'}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-sm text-[#edf8ff]">
              <div className={`h-2.5 w-2.5 rounded-full ${online ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              {online ? 'Payment gateway active' : 'Queueing transaction sync'}
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-x-hidden px-4 py-5 lg:px-6">
          <header className="mb-6 rounded-3xl border border-[#1d2a2e] bg-[#0d1718] px-4 py-4 shadow-[0_12px_32px_rgba(0,0,0,0.26)]">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-center gap-3 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#122d29] text-[#9be7b0]">
                  <Activity size={18} />
                </div>
                <div>
                  <h2 className="dashboard-heading text-2xl font-semibold leading-tight sm:text-3xl lg:text-4xl">{pageTitles[active] || pageTitles.dashboard}</h2>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[#8fa3a0]">OfflinePay • {online ? 'Connected' : 'Queueing'}</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
                <label className="flex w-full min-w-0 items-center gap-2 rounded-2xl border border-[#1d2a2e] bg-[#101b1d] px-3 py-2.5 text-[#a9bdb9] sm:w-[240px]">
                  <Search size={14} />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search transaction"
                    className="w-full border-0 bg-transparent text-sm text-white placeholder:text-[#7d8d8c] focus:outline-none"
                  />
                </label>

                <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${online ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-300'}`}>
                  <span className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                  {online ? 'System online' : 'System offline'}
                </div>

                <button onClick={refresh} className="inline-flex items-center gap-2 rounded-xl border border-[#1d2a2e] bg-[#101b1d] px-3 py-2 text-sm font-medium text-[#edf8ff] hover:bg-[#132426]">
                  <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                  {loading ? 'Syncing' : 'Refresh'}
                </button>
              </div>
            </div>
          </header>

          {active === 'dashboard' && (
            <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="order-last grid min-w-0 justify-items-center gap-6 lg:order-first">
                <OutcomeChart data={outcomeData} isBackend={useBackend && backendConnected} rangeLabel={chartRangeLabel} hasRecords={chartRows.length > 0} />
                <PendingQueueChart data={pendingChartData} rangeLabel={chartRangeLabel} hasRecords={chartRows.length > 0} />
              </div>
              <aside className="order-first h-fit rounded-3xl border border-[#1d2a2e] bg-[#0d1718] p-5 shadow-[0_12px_32px_rgba(0,0,0,0.26)] lg:sticky lg:top-5 lg:order-last">
                <div className="flex items-center gap-2">
                  <CalendarDays size={17} className="text-[#16803a]" />
                  <h3 className="text-base font-semibold text-white">Date Range</h3>
                </div>
                <p className="mt-1 text-xs leading-5 text-[#8fa3a0]">Filter both graphs using transaction timestamps.</p>
                <label className="mt-4 block text-xs font-medium text-[#68746b]" htmlFor="chart-range-type">Range type</label>
                <select id="chart-range-type" value={chartGranularity} onChange={event => setChartGranularity(event.target.value)} className="mt-1 w-full rounded-xl border border-[#dce6dc] bg-white px-3 py-2.5 text-sm text-[#17211c] focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20">
                  <option value="date">Date</option><option value="week">Week</option><option value="month">Month</option><option value="year">Year</option>
                </select>
                <label className="mt-4 block text-xs font-medium text-[#68746b]" htmlFor="chart-anchor-date">{chartGranularity === 'date' ? 'Select date' : 'Choose a date in the range'}</label>
                <input id="chart-anchor-date" type="date" value={chartAnchor} onChange={event => event.target.value && setChartAnchor(event.target.value)} className="mt-1 w-full min-w-0 rounded-xl border border-[#dce6dc] bg-white px-3 py-2.5 text-sm text-[#17211c] focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20" />
                <div className="mt-4 rounded-xl border border-[#e1e8df] bg-[#f4f7f1] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#68746b]">Showing range</p>
                  <p className="mt-1 text-sm font-semibold text-[#17211c]">{chartRangeLabel}</p>
                </div>
                <p className="mt-3 text-[11px] leading-5 text-[#68746b]">{useBackend && backendConnected ? 'Using backend transaction timestamps.' : 'Using local simulator transaction timestamps.'}</p>
              </aside>
            </section>
          )}

          {active === 'transactions' && <Table rows={filtered} onSelect={setSelected} />}

          {active === 'reconciliation' && (() => {
            const resultRows = filtered.filter(tx => ['RECONCILED', 'DUPLICATE', 'CONFLICT', 'FAILED'].includes(String(tx.status ?? '').toUpperCase()));
            return <div className="space-y-5">
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryCard title="Reconciled" value={stats.reconciled} hint="Matched successfully" icon={CheckCircle2} tone="emerald" />
                <SummaryCard title="Duplicate" value={stats.duplicate} hint="Repeated reference detected" icon={Copy} tone="amber" />
                <SummaryCard title="Conflict" value={stats.conflict} hint="Transaction details mismatch" icon={AlertTriangle} tone="red" />
                <SummaryCard title="Failed" value={stats.failed} hint="Could not be processed or synced" icon={FileWarning} tone="red" />
              </section>
              <Table rows={resultRows} onSelect={setSelected} />
              <Pipeline online={online} q={stats.queued} />
            </div>;
          })()}

          {active === 'offline-queue' && <div className="space-y-5">
            <SummaryCard title="Waiting to Sync" value={stats.queued} hint="Transactions queued until connectivity is available." icon={Database} tone="sage" />
            <Table rows={filtered.filter(tx => ['QUEUED', 'SYNCED'].includes(String(tx.status ?? '').toUpperCase()))} onSelect={setSelected} />
          </div>}

          {active === 'simulation-controls' && <SimulationControls
            online={online}
            loading={loading}
            lastSync={lastSync}
            rows={rows}
            createTx={createTx}
            duplicate={duplicate}
            conflict={conflict}
            toggleOnline={toggleSimulatorNetwork}
            sync={sync}
            inspect={() => rows[0] && setSelected(rows[0])}
            queueStatus={() => setRows(prev => prev.map(x => x.status === 'QUEUED' ? {...x, status: 'SYNCED'} : x))}
          />}

          {active === 'logs' && <section className="rounded-3xl border border-[#1d2a2e] bg-[#0d1718] p-5 shadow-[0_12px_32px_rgba(0,0,0,0.26)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div><h3 className="text-lg font-semibold text-white">Reconciliation and Sync History</h3><p className="mt-1 text-sm text-[#8fa3a0]">Recent audit events</p></div>
              <button onClick={() => setLogs(initLogs)} className="rounded-xl border border-[#1d2a2e] bg-[#101b1d] px-3 py-2 text-xs font-semibold text-[#d3e7e6]">Reset</button>
            </div>
            <div className="space-y-3">{logs.map(log => <div key={log.id} className="rounded-2xl border border-[#1d2a2e] bg-[#101b1d] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-[#edf8ff]">{log.action} · {log.tx}</p><div className="flex items-center gap-3"><Badge status={log.result} /><span className="font-mono text-xs text-[#8ea4a1]">{log.time}</span></div></div>
              <p className="mt-2 text-sm text-[#9bb7b5]">{log.detail}</p>
            </div>)}</div>
          </section>}

          {active === 'backend-api' && <section className="max-w-3xl rounded-3xl border border-[#1d2a2e] bg-[#0d1718] p-5 shadow-[0_12px_32px_rgba(0,0,0,0.26)] sm:p-7">
            <h3 className="text-lg font-semibold text-white">Backend API Connection</h3>
            <p className="mt-1 text-sm text-[#8fa3a0]">Choose between live backend requests and the local simulator fallback.</p>
            <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-[#1d2a2e] bg-[#101b1d] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="font-semibold text-[#edf8ff]">{useBackend ? 'Backend API enabled' : 'Local simulator enabled'}</p><p className="mt-1 text-sm text-[#8fa3a0]">{useBackend ? (backendConnected ? 'Connected; data is loaded from the backend.' : 'Connection will be checked; local simulator remains available if it is unreachable.') : 'Using the built-in simulator records and handlers.'}</p></div>
              <button onClick={() => setUseBackend(value => !value)} aria-pressed={useBackend} className={`rounded-xl border px-4 py-3 text-sm font-semibold ${useBackend ? 'border-[#1f433b] bg-[#112d28] text-[#a2f2c2]' : 'border-[#4a3a18] bg-[#2a1d0e] text-[#f7d58f]'}`}>{useBackend ? 'API live' : 'Local sim'}</button>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${backendConnected && useBackend ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-slate-400/30 bg-slate-400/10 text-slate-200'}`}>{backendConnected && useBackend ? 'Backend connected' : 'Simulator data active'}</span>
              <button onClick={refresh} disabled={loading || !useBackend} className="inline-flex items-center gap-2 rounded-xl border border-[#1d2a2e] bg-[#101b1d] px-3 py-2 text-sm font-medium text-[#edf8ff] disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} />{loading ? 'Checking' : 'Refresh backend data'}</button>
            </div>
          </section>}
        </main>
      </div>

      {toast && (
        <div className={`fixed ${networkPopup ? 'bottom-24' : 'bottom-5'} right-5 z-[60] rounded-xl border px-4 py-3 text-sm font-medium shadow-[0_14px_30px_rgba(0,0,0,0.3)] ${toast.type === 'warning' ? 'border-amber-500/30 bg-[#2a1d0e] text-[#f7d58f]' : 'border-emerald-500/30 bg-[#112d28] text-[#a2f2c2]'}`}>
          <div className="flex items-center gap-2">
            {toast.type === 'warning' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {networkPopup && (() => {
        const isPaymentHold = networkPopup.kind === 'payment-hold';
        const isPaymentSuccess = networkPopup.kind === 'payment-success';
        const isPaymentFailure = networkPopup.kind === 'payment-sync-failed';
        const isGreen = isPaymentSuccess || (!isPaymentHold && !isPaymentFailure && networkPopup.online);
        const popupTone = isPaymentHold ? 'network-status-hold' : isGreen ? 'network-status-online' : 'network-status-offline';
        const title = isPaymentHold ? 'Payment on hold' : isPaymentSuccess ? 'Payment successful' : isPaymentFailure ? 'Payment sync failed' : `System is ${networkPopup.online ? 'online' : 'offline'}`;
        const message = networkPopup.message || (isPaymentHold
          ? 'Saved to the offline queue. It will sync when the connection returns.'
          : isPaymentSuccess
            ? 'The payment was reconciled successfully.'
            : isPaymentFailure
              ? 'You’re offline. Try again when the connection returns.'
              : `Simulator payment network ${networkPopup.online ? 'connected' : 'disconnected'}.`);
        return <div key={networkPopup.id} role="status" aria-live="polite" aria-atomic="true" className={`network-status-popup fixed left-1/2 top-24 z-[70] flex w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 items-center gap-4 rounded-2xl border p-5 shadow-[0_16px_36px_rgba(18,35,24,0.2)] sm:gap-5 sm:p-6 ${networkPopup.closing ? 'is-closing' : ''} ${popupTone}`}>
        <span className="network-status-icon relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl sm:h-16 sm:w-16" data-online={networkPopup.online} data-kind={networkPopup.kind}>
          {isPaymentHold ? <Clock3 size={30} aria-hidden="true" /> : isPaymentSuccess ? <CheckCircle2 size={30} aria-hidden="true" /> : isPaymentFailure ? <AlertTriangle size={30} aria-hidden="true" /> : networkPopup.online ? <Wifi size={30} aria-hidden="true" /> : <WifiOff size={30} aria-hidden="true" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold sm:text-xl">{title}</p>
          <p className="mt-1 text-sm opacity-80">{message}</p>
          {networkPopup.transactionId && <p className="mt-1 text-xs font-medium opacity-65">Transaction ID: {networkPopup.transactionId}</p>}
        </div>
        <button type="button" onClick={dismissNetworkPopup} aria-label="Dismiss network status message" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-current">
          <X size={20} aria-hidden="true" />
        </button>
      </div>;
      })()}

      {selected && <Drawer tx={selected} close={() => setSelected(null)} reconcile={reconcile} fail={fail} />}
    </div>
  );
}
