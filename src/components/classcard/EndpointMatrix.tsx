'use client';

import React, { useState } from 'react';
import { db } from '../../lib/db/store';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../ui/Table';
import { Badge } from '../ui/Badge';
import { Search } from 'lucide-react';

export function EndpointMatrix() {
  const endpoints = db.getClasscardEndpoints();
  const [filterGroup, setFilterGroup] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');

  const groups = Array.from(new Set(endpoints.map((e) => e.group)));

  const filtered = endpoints.filter((ep) => {
    if (filterGroup !== 'ALL' && ep.group !== filterGroup) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!ep.name.toLowerCase().includes(q) && !ep.endpoint.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  const getMethodBadge = (method: string) => {
    switch (method) {
      case 'GET':
        return <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-100 text-sky-800">GET</span>;
      case 'POST':
        return <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">POST</span>;
      case 'PUT':
        return <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">PUT</span>;
      case 'DELETE':
        return <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">DEL</span>;
      default:
        return <span className="font-mono text-[10px]">{method}</span>;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <select
            value={filterGroup}
            onChange={(e) => setFilterGroup(e.target.value)}
            className="text-xs font-medium bg-white border border-slate-200 rounded-lg px-2.5 py-1.5"
          >
            <option value="ALL">All API Endpoint Groups ({endpoints.length})</option>
            {groups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search endpoint name or path..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs w-64"
          />
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Endpoint Name</TableHead>
            <TableHead>Group</TableHead>
            <TableHead>Method & Path</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Adapter Specification / Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((ep) => (
            <TableRow key={ep.id}>
              <TableCell className="font-semibold text-slate-900">{ep.name}</TableCell>
              <TableCell>
                <Badge variant="neutral" size="sm">
                  {ep.group}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  {getMethodBadge(ep.method)}
                  <code className="text-xs font-mono text-slate-700 bg-slate-50 px-1 py-0.5 rounded">
                    {ep.endpoint}
                  </code>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={ep.status === 'OPERATIONAL' ? 'success' : 'warning'} size="sm" dot>
                  {ep.status}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-slate-500">{ep.notes}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
