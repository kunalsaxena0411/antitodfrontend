import React, { useEffect, useMemo, useState } from 'react';
import { Check, Layers, Plus, Search } from 'lucide-react';

export interface StencilItem {
    id?: string;
    type: string;
    label: string;
    description?: string;
    iconName?: string;
    color?: string;
    [key: string]: any;
}

export interface StencilGroup {
    title: string;
    items: StencilItem[];
}

interface StencilPaletteProps {
    groups: StencilGroup[];
    query: string;
    onQueryChange: (value: string) => void;
    onAdd: (item: StencilItem, e?: React.MouseEvent) => void;
    onCreate?: () => void;
    getIcon: (item: StencilItem) => React.ComponentType<{
        size?: number;
        className?: string;
    }>;
    title?: string;
    placeholder?: string;
    showCreate?: boolean;
}

export default function StencilPalette({
    groups,
    query,
    onQueryChange,
    onAdd,
    onCreate,
    getIcon,
    title = 'STENCILS',
    placeholder = 'Search components...',
    showCreate = true,
}: StencilPaletteProps) {
    const [recentlyAdded, setRecentlyAdded] = useState<string | null>(null);

    const totalItems = useMemo(
        () => groups.reduce((total, group) => total + group.items.length, 0),
        [groups]
    );

    const handleAdd = (item: StencilItem, e: React.MouseEvent) => {
        const key = item.id || `${item.type}:${item.label}`;

        onAdd(item, e);
        setRecentlyAdded(key);

        window.setTimeout(() => {
            setRecentlyAdded(current => (
                current === key ? null : current
            ));
        }, 700);
    };

    useEffect(() => {
        return () => {
            setRecentlyAdded(null);
        };
    }, []);

    return (
        <div className="flex min-h-0 flex-1 flex-col bg-at-surface">
            {/* Header */}
            <div className="border-b border-at-border bg-at-surface-raised px-3.5 py-3">
                <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Layers
                            size={14}
                            className="text-at-muted"
                        />

                        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-at-text-secondary">
                            {title}
                        </span>

                        <span className="rounded-md border border-at-border bg-at-subtle px-1.5 py-0.5 font-mono text-[9px] text-at-muted">
                            {totalItems}
                        </span>
                    </div>

                    {showCreate && onCreate && (
                        <button
                            type="button"
                            onClick={onCreate}
                            className="
                                flex h-7 w-7 items-center justify-center
                                rounded-md
                                border border-at-border
                                bg-at-bg
                                text-at-muted
                                transition-colors
                                hover:border-at-border-strong
                                hover:bg-at-surface-hover
                                hover:text-at-text
                            "
                            title="Create custom stencil"
                        >
                            <Plus size={15} />
                        </button>
                    )}
                </div>

                <label className="relative block">
                    <Search
                        size={14}
                        className="
                            pointer-events-none
                            absolute left-3 top-1/2
                            -translate-y-1/2
                            text-at-disabled
                        "
                    />

                    <input
                        type="text"
                        value={query}
                        onChange={(event) => onQueryChange(event.target.value)}
                        placeholder={placeholder}
                        className="
                            h-9 w-full
                            rounded-md
                            border border-at-border
                            bg-at-bg
                            pl-9 pr-3
                            text-[12px] text-at-text
                            outline-none
                            placeholder:text-at-disabled
                            transition-colors
                            focus:border-at-border-strong
                            focus:bg-at-surface
                        "
                    />
                </label>
            </div>

            {/* Stencil groups */}
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 custom-scrollbar">
                {groups.length === 0 && (
                    <div className="flex min-h-[180px] items-center justify-center">
                        <div className="text-center">
                            <div className="mb-2 text-[12px] font-medium text-at-text-secondary">
                                No components found
                            </div>

                            <div className="text-[10px] text-at-muted">
                                Try a different search term.
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-5">
                    {groups.map((group) => (
                        <section key={group.title}>
                            <div className="mb-2 flex items-center justify-between px-1">
                                <div className="flex items-center gap-2">
                                    <span className="h-1 w-1 rounded-full bg-at-muted" />

                                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-at-muted">
                                        {group.title}
                                    </span>
                                </div>

                                <span className="font-mono text-[9px] text-at-disabled">
                                    {group.items.length}
                                </span>
                            </div>

                            <div className="space-y-1.5">
                                {group.items.map((item) => {
                                    const Icon = getIcon(item);
                                    const key = item.id || `${item.type}:${item.label}`;
                                    const isRecentlyAdded = recentlyAdded === key;

                                    return (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={(e) => handleAdd(item, e)}
                                            className={`
                                                group
                                                flex w-full items-center gap-3
                                                rounded-lg
                                                border border-at-border
                                                bg-at-bg
                                                px-2.5 py-2.5
                                                text-left
                                                transition-all duration-150
                                                hover:border-at-border-strong
                                                hover:bg-at-surface-hover
                                                active:scale-[0.995]
                                            `}
                                        >
                                            <span
                                                className="
                                                    flex h-8 w-8 shrink-0
                                                    items-center justify-center
                                                    rounded-md
                                                    border border-at-border
                                                    bg-at-subtle
                                                    text-at-muted
                                                    transition-colors
                                                    group-hover:border-at-border-strong
                                                    group-hover:text-at-accent
                                                "
                                            >
                                                <Icon size={16} />
                                            </span>

                                            <span className="min-w-0 flex-1">
                                                <span
                                                    className="
                                                        block truncate
                                                        text-[12px]
                                                        font-medium
                                                        text-at-text-secondary
                                                        transition-colors
                                                        group-hover:text-at-text
                                                    "
                                                >
                                                    {item.label}
                                                </span>

                                                {item.description && (
                                                    <span
                                                        className="
                                                            mt-0.5 block truncate
                                                            text-[10px]
                                                            text-at-muted
                                                        "
                                                    >
                                                        {item.description}
                                                    </span>
                                                )}
                                            </span>

                                            <span
                                                className={`
                                                    flex h-7 w-7 shrink-0
                                                    items-center justify-center
                                                    rounded-md
                                                    border
                                                    transition-all
                                                    ${
                                                        isRecentlyAdded
                                                            ? `
                                                                border-at-accent/40
                                                                bg-at-accent/10
                                                                text-at-accent
                                                            `
                                                            : `
                                                                border-at-border
                                                                bg-at-surface
                                                                text-at-disabled
                                                                group-hover:border-at-border-strong
                                                                group-hover:bg-at-subtle
                                                                group-hover:text-at-accent
                                                            `
                                                    }
                                                `}
                                                aria-hidden="true"
                                            >
                                                {isRecentlyAdded ? (
                                                    <Check size={14} />
                                                ) : (
                                                    <Plus size={14} />
                                                )}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </section>
                    ))}
                </div>
            </div>
        </div>
    );
}
