import React, { useState, useEffect, useRef } from 'react';
import api from '../../api/axios';
import Badge from '../ui/Badge';
import Spinner from '../ui/Spinner';
import Button from '../ui/Button';

const OfficialTaxSelector = ({
  classificationType = 'HSN', // 'HSN' or 'SAC'
  selectedTaxConfigId = null,
  selectedHsnSac = '',
  savedTaxConfigs = [],
  onSelect,
  onConfigConfirmed
}) => {
  const [activeTab, setActiveTab] = useState('official'); // 'official' | 'saved'
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [datasetVersion, setDatasetVersion] = useState('');

  // Selected details
  const [confirmedInfo, setConfirmedInfo] = useState(null);
  const [isConfirming, setIsConfirming] = useState(false);

  // Manual override state
  const [showOverrideFor, setShowOverrideFor] = useState(null); // classification code or null
  const [overrideCategory, setOverrideCategory] = useState('ADVANCE_RULING');
  const [overrideDetails, setOverrideDetails] = useState('');
  const [overrideRate, setOverrideRate] = useState('18');
  const [overrideError, setOverrideError] = useState('');

  const debounceRef = useRef(null);

  // Sync confirmedInfo with props or saved configs
  useEffect(() => {
    if (selectedTaxConfigId && savedTaxConfigs.length > 0) {
      const match = savedTaxConfigs.find(tc => tc._id === selectedTaxConfigId);
      if (match) {
        setConfirmedInfo(match);
      }
    } else if (selectedHsnSac && savedTaxConfigs.length > 0) {
      const match = savedTaxConfigs.find(tc => tc.hsnSac === selectedHsnSac);
      if (match) {
        setConfirmedInfo(match);
      }
    }
  }, [selectedTaxConfigId, selectedHsnSac, savedTaxConfigs]);

  // Debounced search when query changes
  useEffect(() => {
    if (activeTab !== 'official') return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        setIsSearching(true);
        setSearchError('');
        const res = await api.get('/reference/hsn-sac/search', {
          params: {
            q: query.trim(),
            type: classificationType,
            limit: 15
          }
        });
        if (res.data?.success) {
          setSearchResults(res.data.data.results || []);
          setDatasetVersion(res.data.data.datasetVersion || '');
        }
      } catch (err) {
        setSearchError('Failed to fetch official classifications.');
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [query, classificationType, activeTab]);

  // Confirm official statutory rule selection
  const handleConfirmRule = async (classification, rule) => {
    try {
      setIsConfirming(true);
      const res = await api.post('/tax-config/confirm', {
        classificationType: classification.classificationType || classificationType,
        hsnSac: classification.code,
        ruleId: rule.ruleId,
        description: classification.description
      });

      if (res.data?.success) {
        const config = res.data.data.taxConfig;
        setConfirmedInfo(config);
        if (onConfigConfirmed) onConfigConfirmed(config);
        if (onSelect) {
          onSelect({
            taxConfigId: config._id,
            hsnSac: config.hsnSac,
            gstRate: config.gstRate,
            ruleId: config.ruleId,
            description: config.description,
            isOfficialReference: true
          });
        }
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to confirm statutory tax rule.');
    } finally {
      setIsConfirming(false);
    }
  };

  // Submit manual override
  const handleSubmitOverride = async (classification) => {
    if (!overrideDetails || overrideDetails.trim().length < 5) {
      setOverrideError('Detailed statutory justification (min 5 characters) is required.');
      return;
    }

    try {
      setIsConfirming(true);
      setOverrideError('');
      const res = await api.post('/tax-config/confirm', {
        classificationType: classification.classificationType || classificationType,
        hsnSac: classification.code,
        ruleId: `${classification.code}-OVERRIDE`,
        isManualOverride: true,
        overrideReasonCategory: overrideCategory,
        overrideReasonDetails: overrideDetails.trim(),
        overrideGstRate: parseFloat(overrideRate),
        overrideTaxTreatment: 'TAXABLE',
        description: classification.description
      });

      if (res.data?.success) {
        const config = res.data.data.taxConfig;
        setConfirmedInfo(config);
        setShowOverrideFor(null);
        if (onConfigConfirmed) onConfigConfirmed(config);
        if (onSelect) {
          onSelect({
            taxConfigId: config._id,
            hsnSac: config.hsnSac,
            gstRate: config.gstRate,
            ruleId: config.ruleId,
            description: config.description,
            isOfficialReference: true,
            isManualOverride: true
          });
        }
      }
    } catch (err) {
      setOverrideError(err.response?.data?.message || 'Failed to save manual override.');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleSelectSaved = (e) => {
    const configId = e.target.value;
    if (!configId) {
      setConfirmedInfo(null);
      if (onSelect) onSelect({ taxConfigId: null, hsnSac: null, gstRate: 0 });
      return;
    }
    const match = savedTaxConfigs.find(c => c._id === configId);
    if (match) {
      setConfirmedInfo(match);
      if (onSelect) {
        onSelect({
          taxConfigId: match._id,
          hsnSac: match.hsnSac,
          gstRate: match.gstRate,
          ruleId: match.ruleId,
          description: match.description,
          isOfficialReference: match.isOfficialReference
        });
      }
    }
  };

  const clearSelection = () => {
    setConfirmedInfo(null);
    setQuery('');
    setSearchResults([]);
    if (onSelect) {
      onSelect({ taxConfigId: null, hsnSac: null, gstRate: 0 });
    }
  };

  return (
    <div className="space-y-3">
      {/* Current Active Confirmation Banner */}
      {confirmedInfo ? (
        <div className="bg-emerald-50 border border-emerald-200/90 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm text-emerald-950 font-mono tracking-wide">
                  [{confirmedInfo.classificationType || classificationType} {confirmedInfo.hsnSac}]
                </span>
                <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  {confirmedInfo.gstRate}% GST
                </span>
                {confirmedInfo.isManualOverride ? (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                    Manual Override: {confirmedInfo.overrideReasonCategory}
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-100 text-sky-800 border border-sky-300">
                    Official Reference
                  </span>
                )}
              </div>
              <p className="text-xs text-emerald-900 mt-1 line-clamp-2">
                {confirmedInfo.description || 'Confirmed statutory tax configuration'}
              </p>
              {confirmedInfo.notificationReference && (
                <p className="text-[10px] text-emerald-700 font-medium mt-0.5">
                  Statutory Ref: {confirmedInfo.notificationReference}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={clearSelection}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 px-2.5 py-1.5 rounded-lg border border-emerald-300 hover:bg-emerald-100/60 transition-colors shrink-0 self-start sm:self-center"
          >
            Change / Clear
          </button>
        </div>
      ) : (
        <div>
          {/* Tab Selection */}
          <div className="flex border-b border-slate-200 mb-3 gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('official')}
              className={`pb-2 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${
                activeTab === 'official'
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Govt HSN/SAC Directory
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('saved')}
              className={`pb-2 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${
                activeTab === 'saved'
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              My Saved Tax Configs ({savedTaxConfigs.length})
            </button>
          </div>

          {activeTab === 'official' ? (
            <div className="space-y-3">
              {/* Search Bar */}
              <div className="relative">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Search ${classificationType} code (e.g. ${classificationType === 'Service' ? '9983' : '8471'}) or keyword (e.g. ${classificationType === 'Service' ? 'consulting, repair' : 'laptop, footwear'})...`}
                  className="block w-full h-10 pl-9 pr-8 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors"
                />
                <svg
                  className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {isSearching && (
                  <div className="absolute right-3 top-2.5">
                    <Spinner size="sm" />
                  </div>
                )}
              </div>

              {searchError && (
                <p className="text-xs text-rose-600">{searchError}</p>
              )}

              {/* Search Results Display */}
              {searchResults.length > 0 ? (
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {searchResults.map((item) => (
                    <div
                      key={item._id || item.code}
                      className="p-3 bg-white border border-slate-200/90 rounded-xl hover:border-indigo-300 hover:shadow-xs transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-sm text-indigo-950 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                              {item.code}
                            </span>
                            <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              {item.digits}-digit {item.classificationType}
                            </span>
                            {item.hasMultipleRules && (
                              <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                Value Slab / Multiple Rates
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-medium text-slate-800 mt-1.5 leading-snug">
                            {item.description}
                          </p>
                          {item.tradeAliases && item.tradeAliases.length > 0 && (
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Trade terms: <span className="italic">{item.tradeAliases.join(', ')}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Candidate Statutory Rules */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100">
                        <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                          Statutory Rate Rules:
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {item.rules && item.rules.length > 0 ? (
                            item.rules.map((rule) => (
                              <button
                                key={rule.ruleId}
                                type="button"
                                disabled={isConfirming}
                                onClick={() => handleConfirmRule(item, rule)}
                                className="text-left p-2.5 rounded-lg border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all group flex flex-col justify-between"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-xs text-indigo-900 group-hover:text-indigo-700">
                                    {rule.gstRate}% GST
                                  </span>
                                  <span className="text-[10px] font-medium text-slate-500">
                                    ({rule.cgstRate}% + {rule.sgstRate}%)
                                  </span>
                                </div>
                                {rule.conditionDescription && (
                                  <p className="text-[11px] text-slate-700 mt-1 leading-tight line-clamp-2">
                                    {rule.conditionDescription}
                                  </p>
                                )}
                                <span className="text-[9px] text-slate-600 mt-1 block truncate">
                                  {rule.notificationReference}
                                </span>
                              </button>
                            ))
                          ) : (
                            <div className="col-span-2 text-xs text-slate-500 italic">
                              No explicit rate rule registered. Click below to configure rate.
                            </div>
                          )}
                        </div>

                        {/* Manual Override Action */}
                        <div className="mt-2 text-right">
                          <button
                            type="button"
                            onClick={() => setShowOverrideFor(showOverrideFor === item.code ? null : item.code)}
                            className="text-[11px] font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
                          >
                            {showOverrideFor === item.code ? 'Cancel Override' : 'Apply Special Override (AAR / Exemption)'}
                          </button>
                        </div>

                        {/* Override Form Panel */}
                        {showOverrideFor === item.code && (
                          <div className="mt-2 p-3 bg-amber-50/60 border border-amber-200 rounded-lg space-y-2">
                            <p className="text-xs font-bold text-amber-900">
                              Statutory Ground for Manual Rate Override
                            </p>
                            {overrideError && (
                              <p className="text-xs text-rose-600">{overrideError}</p>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                                  Override Reason *
                                </label>
                                <select
                                  value={overrideCategory}
                                  onChange={(e) => setOverrideCategory(e.target.value)}
                                  className="w-full text-xs h-8 px-2 border border-slate-300 rounded bg-white"
                                >
                                  <option value="ADVANCE_RULING">Advance Ruling (AAR / AAAR)</option>
                                  <option value="SPECIFIC_EXEMPTION">Specific Exemption Notification</option>
                                  <option value="EXPORT_BOND">Export under LUT / Bond</option>
                                  <option value="OTHER">Other Lawful Ground</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                                  Applicable GST Rate (%) *
                                </label>
                                <select
                                  value={overrideRate}
                                  onChange={(e) => setOverrideRate(e.target.value)}
                                  className="w-full text-xs h-8 px-2 border border-slate-300 rounded bg-white"
                                >
                                  <option value="0">0% (Exempt / Nil)</option>
                                  <option value="5">5%</option>
                                  <option value="12">12%</option>
                                  <option value="18">18%</option>
                                  <option value="28">28%</option>
                                </select>
                              </div>
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                                Justification & Reference Details *
                              </label>
                              <input
                                type="text"
                                value={overrideDetails}
                                onChange={(e) => setOverrideDetails(e.target.value)}
                                placeholder="e.g. AAR Order No. 42/2026 or Notification No. 12/2025"
                                className="w-full text-xs h-8 px-2 border border-slate-300 rounded bg-white"
                              />
                            </div>
                            <div className="text-right pt-1">
                              <Button
                                size="sm"
                                type="button"
                                disabled={isConfirming}
                                onClick={() => handleSubmitOverride(item)}
                              >
                                {isConfirming ? 'Saving...' : 'Confirm Override'}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : query && !isSearching ? (
                <div className="p-4 bg-slate-50 rounded-xl text-center border border-slate-200">
                  <p className="text-xs text-slate-600">
                    No official classifications found matching "{query}".
                  </p>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Try searching by 2 or 4 digits (e.g. 84, 8471, 9983) or simpler keyword.
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <div>
              {/* Saved Configurations Dropdown */}
              <select
                value={selectedTaxConfigId || ''}
                onChange={handleSelectSaved}
                className="block w-full h-10 px-3 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors"
              >
                <option value="">-- None (Non-GST / Exempt) --</option>
                {savedTaxConfigs
                  .filter(tc => !classificationType || tc.classificationType === classificationType)
                  .map(tc => (
                    <option key={tc._id} value={tc._id}>
                      [{tc.classificationType} {tc.hsnSac}] {tc.gstRate}% GST — {tc.description || 'Configured'}
                    </option>
                  ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Select from configurations already active on your business profile.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OfficialTaxSelector;

