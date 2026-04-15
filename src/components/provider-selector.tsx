"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Provider {
  name: string;
  models: string[];
}

interface ProviderSelectorProps {
  provider: string;
  model: string;
  onProviderChange: (provider: string) => void;
  onModelChange: (model: string) => void;
}

export function ProviderSelector({
  provider,
  model,
  onProviderChange,
  onModelChange,
}: ProviderSelectorProps) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProviders() {
      try {
        const response = await fetch("/api/providers");
        if (!response.ok) {
          throw new Error("Failed to fetch providers");
        }
        const data = (await response.json()) as Provider[];
        setProviders(data);

        if (data.length > 0 && !provider) {
          onProviderChange(data[0].name);
          if (data[0].models.length > 0) {
            onModelChange(data[0].models[0]);
          }
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    void fetchProviders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentProvider = providers.find((p) => p.name === provider);
  const availableModels = currentProvider?.models ?? [];

  function handleProviderChange(value: string | null) {
    if (!value) return;
    onProviderChange(value);
    const selected = providers.find((p) => p.name === value);
    if (selected && selected.models.length > 0) {
      onModelChange(selected.models[0]);
    } else {
      onModelChange("");
    }
  }

  function handleModelChange(value: string | null) {
    onModelChange(value ?? "");
  }

  if (loading) {
    return (
      <div className="flex items-center gap-4">
        <p className="text-sm text-slate-400">Loading providers...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-4">
        <p className="text-sm text-red-500">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="provider-select" className="text-sm font-medium">
          Provider
        </Label>
        <Select value={provider} onValueChange={handleProviderChange}>
          <SelectTrigger id="provider-select" className="w-40">
            <SelectValue placeholder="Select provider" />
          </SelectTrigger>
          <SelectContent>
            {providers.map((p) => (
              <SelectItem key={p.name} value={p.name}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="model-select" className="text-sm font-medium">
          Model
        </Label>
        <Select
          value={model}
          onValueChange={handleModelChange}
          disabled={availableModels.length === 0}
        >
          <SelectTrigger id="model-select" className="w-56">
            <SelectValue placeholder="Select model" />
          </SelectTrigger>
          <SelectContent>
            {availableModels.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
