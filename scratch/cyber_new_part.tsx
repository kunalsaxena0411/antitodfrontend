export const CyberChefView: React.FC<CyberChefViewProps> = ({
    onNavigateToIntel,
}) => {
    const [input, setInput] = useState(
        () => localStorage.getItem('cyberchef_input') || ''
    );

    const [recipe, setRecipe] = useState<RecipeStep[]>(() => {
        try {
            const saved = localStorage.getItem('cyberchef_recipe');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    const [output, setOutput] = useState('');
    const [isBaking, setIsBaking] = useState(false);
    const [isCookingAi, setIsCookingAi] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [copied, setCopied] = useState(false);
    const [autoBake, setAutoBake] = useState(true);
    const [forEachLine, setForEachLine] = useState(false);
    const [activeCategory, setActiveCategory] = useState<OpCategory | 'All'>('All');

    useEffect(() => {
        localStorage.setItem('cyberchef_input', input);
        localStorage.setItem(
            'cyberchef_recipe',
            JSON.stringify(recipe)
        );
    }, [input, recipe]);

    const bake = async () => {
        if (!input && recipe.length === 0) {
            setOutput('');
            return;
        }

        setIsBaking(true);

        try {
            const processData = async (data: string) => {
                let currentData = data;
                const registers: Record<string, string> = {};

                for (const step of recipe) {
                    if (step.disabled) continue;

                    const op = OPERATIONS.find(
                        (operation) => operation.id === step.opId
                    );

                    if (!op) continue;

                    if (currentData.startsWith('IMAGE_DATA:')) {
                        if (op.id !== 'ai-ocr') {
                            currentData =
                                '[Piping images to text-based operations is not supported. Use OCR first.]';
                            break;
                        }

                        currentData = currentData.replace(
                            'IMAGE_DATA:data:image/png;base64,',
                            ''
                        );

                        const binary = atob(currentData);

                        currentData = Array.from(binary)
                            .map((char) =>
                                char
                                    .charCodeAt(0)
                                    .toString(16)
                                    .padStart(2, '0')
                            )
                            .join('');
                    }

                    currentData = await op.run(
                        currentData,
                        step.args,
                        registers
                    );
                }

                return currentData;
            };

            if (forEachLine) {
                const lines = input.split(/\r?\n/);

                const results = await Promise.all(
                    lines.map((line) => processData(line))
                );

                setOutput(results.join('\n'));
            } else {
                setOutput(await processData(input));
            }
        } catch (error) {
            console.error('CyberChef execution failed:', error);
            setOutput('[CRITICAL ERROR IN RECIPE CHAIN]');
        } finally {
            setIsBaking(false);
        }
    };

    const handleMagicWand = async () => {
        if (!input || isCookingAi) return;

        setIsCookingAi(true);

        try {
            const ai = new GoogleGenAI({
                apiKey: GEMINI_API_KEY,
            });

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `
Analyze the following data for common cybersecurity obfuscation,
encoding, or compression patterns.

Suggest a multi-step CyberChef recipe to decode or analyze it.

Return ONLY a JSON array of operations.

Valid operation IDs:
${OPERATIONS.map((operation) => `'${operation.id}'`).join(', ')}

Each object:
- "opId": exact operation ID
- "args": object with operation arguments

Data:
${input.substring(0, 4000)}
                `,
                config: {
                    responseMimeType: 'application/json',
                },
            });

            const suggestedSteps = JSON.parse(
                response.text
            );

            if (Array.isArray(suggestedSteps)) {
                const newSteps: RecipeStep[] =
                    suggestedSteps
                        .map((step: any) => ({
                            id: crypto.randomUUID(),
                            opId: step.opId,
                            args: step.args || {},
                        }))
                        .filter((step: RecipeStep) =>
                            OPERATIONS.some(
                                (operation) =>
                                    operation.id === step.opId
                            )
                        );

                setRecipe(newSteps);
            }
        } catch (error) {
            console.error(
                'CyberChef AI suggestion failed:',
                error
            );
        } finally {
            setIsCookingAi(false);
        }
    };

    useEffect(() => {
        if (!autoBake) return;

        const timer = window.setTimeout(() => {
            void bake();
        }, 400);

        return () => {
            window.clearTimeout(timer);
        };
    }, [
        input,
        recipe,
        autoBake,
        forEachLine,
    ]);

    const addOp = (opId: string) => {
        const op = OPERATIONS.find(
            (operation) => operation.id === opId
        );

        const initialArgs: Record<string, any> = {};

        op?.args?.forEach((argument) => {
            initialArgs[argument.name] =
                argument.default;
        });

        setRecipe((currentRecipe) => [
            ...currentRecipe,
            {
                id: crypto.randomUUID(),
                opId,
                args: initialArgs,
            },
        ]);

        setActiveCategory(
            op?.category || 'All'
        );
    };

    const updateArg = (
        stepId: string,
        argName: string,
        value: any
    ) => {
        setRecipe((currentRecipe) =>
            currentRecipe.map((step) =>
                step.id === stepId
                    ? {
                          ...step,
                          args: {
                              ...step.args,
                              [argName]: value,
                          },
                      }
                    : step
            )
        );
    };

    const toggleStep = (id: string) => {
        setRecipe((currentRecipe) =>
            currentRecipe.map((step) =>
                step.id === id
                    ? {
                          ...step,
                          disabled: !step.disabled,
                      }
                    : step
            )
        );
    };

    const removeStep = (id: string) => {
        setRecipe((currentRecipe) =>
            currentRecipe.filter(
                (step) => step.id !== id
            )
        );
    };

    const clearRecipe = () => {
        setRecipe([]);
        setOutput('');
    };

    const clearInput = () => {
        setInput('');
        setOutput('');
    };

    const handleCopy = async () => {
        if (!output) return;

        const textToCopy = output.startsWith(
            'IMAGE_DATA:'
        )
            ? output.split(',')[1]
            : output;

        try {
            await navigator.clipboard.writeText(
                textToCopy
            );

            setCopied(true);

            window.setTimeout(() => {
                setCopied(false);
            }, 2000);
        } catch (error) {
            console.error(
                'Clipboard copy failed:',
                error
            );
        }
    };

    const renderInteractiveOutput = (
        text: string
    ) => {
        if (!text) return null;

        const iocRegex =
            /(\b(?:\d{1,3}\.){3}\d{1,3}\b|\b[a-f0-9]{64}\b|\b[a-f0-9]{32}\b|\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b)/gi;

        const parts = text.split(iocRegex);

        return parts.map((part, index) => {
            if (
                part &&
                part.match(iocRegex)
            ) {
                const isDomain =
                    part.includes('.');

                if (
                    isDomain &&
                    part.length < 4
                ) {
                    return part;
                }

                return (
                    <button
                        key={index}
                        type="button"
                        onClick={() =>
                            onNavigateToIntel?.(
                                part
                            )
                        }
                        className="
                            cyberchef-ioc
                        "
                        title={`Search Intelligence for: ${part}`}
                    >
                        {part}
                        <ExternalLink size={10} />
                    </button>
                );
            }

            return part;
        });
    };

    const categories: OpCategory[] =
        Array.from(
            new Set(
                OPERATIONS.map(
                    (operation) =>
                        operation.category
                )
            )
        );

    const filteredOps = useMemo(() => {
        const lower =
            searchTerm
                .trim()
                .toLowerCase();

        return OPERATIONS.filter((operation) => {
            const matchesSearch =
                !lower ||
                operation.name
                    .toLowerCase()
                    .includes(lower) ||
                operation.category
                    .toLowerCase()
                    .includes(lower) ||
                operation.description
                    .toLowerCase()
                    .includes(lower);

            const matchesCategory =
                activeCategory === 'All' ||
                operation.category ===
                    activeCategory;

            return (
                matchesSearch &&
                matchesCategory
            );
        });
    }, [searchTerm, activeCategory]);

    const activeRecipeCount =
        recipe.filter(
            (step) => !step.disabled
        ).length;

    return (
        <div className="cyberchef-page">

            {/* =========================================================
                OPERATION LIBRARY
               ========================================================= */}

            <aside className="cyberchef-library">

                <div className="cyberchef-library-header">

                    <div className="cyberchef-section-title">
                        <span className="cyberchef-section-icon">
                            <Settings2 size={14} />
                        </span>

                        <div>
                            <span className="cyberchef-eyebrow">
                                TOOLS
                            </span>

                            <strong>
                                Operations
                            </strong>
                        </div>
                    </div>

                    <span className="cyberchef-count">
                        {OPERATIONS.length}
                    </span>
                </div>

                <div className="cyberchef-search-wrap">

                    <Search
                        size={14}
                        className="cyberchef-search-icon"
                    />

                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(event) =>
                            setSearchTerm(
                                event.target.value
                            )
                        }
                        placeholder="Search operations..."
                        className="cyberchef-search"
                    />
                </div>

                <div className="cyberchef-category-scroll">

                    <button
                        type="button"
                        className={`
                            cyberchef-category-chip
                            ${
                                activeCategory ===
                                'All'
                                    ? 'active'
                                    : ''
                            }
                        `}
                        onClick={() =>
                            setActiveCategory('All')
                        }
                    >
                        All
                    </button>

                    {categories.map(
                        (category) => (
                            <button
                                key={category}
                                type="button"
                                className={`
                                    cyberchef-category-chip
                                    ${
                                        activeCategory ===
                                        category
                                            ? 'active'
                                            : ''
                                    }
                                `}
                                onClick={() =>
                                    setActiveCategory(
                                        category
                                    )
                                }
                            >
                                {category}
                            </button>
                        )
                    )}

                </div>

                <div className="cyberchef-library-list custom-scrollbar">

                    {categories.map(
                        (category) => {
                            const opsInCategory =
                                filteredOps.filter(
                                    (operation) =>
                                        operation.category ===
                                        category
                                );

                            if (
                                opsInCategory.length ===
                                0
                            ) {
                                return null;
                            }

                            return (
                                <section
                                    key={category}
                                    className="cyberchef-operation-group"
                                >

                                    <div className="cyberchef-group-heading">
                                        <span>
                                            {category}
                                        </span>

                                        <span className="cyberchef-group-count">
                                            {opsInCategory.length}
                                        </span>
                                    </div>

                                    <div className="cyberchef-operation-list">

                                        {opsInCategory.map(
                                            (operation) => {
                                                const Icon =
                                                    operation.icon;

                                                return (
                                                    <button
                                                        key={operation.id}
                                                        type="button"
                                                        className="cyberchef-operation"
                                                        onClick={() =>
                                                            addOp(
                                                                operation.id
                                                            )
                                                        }
                                                    >
                                                        <span className="cyberchef-operation-icon">
                                                            <Icon
                                                                size={15}
                                                            />
                                                        </span>

                                                        <span className="cyberchef-operation-content">

                                                            <span className="cyberchef-operation-name">
                                                                {
                                                                    operation.name
                                                                }
                                                            </span>

                                                            <span className="cyberchef-operation-description">
                                                                {
                                                                    operation.description
                                                                }
                                                            </span>

                                                        </span>

                                                        <span className="cyberchef-operation-add">
                                                            <Plus
                                                                size={13}
                                                            />
                                                        </span>
                                                    </button>
                                                );
                                            }
                                        )}

                                    </div>
                                </section>
                            );
                        }
                    )}

                    {filteredOps.length === 0 && (
                        <div className="cyberchef-empty-library">
                            <Search size={22} />
                            <strong>
                                No operations found
                            </strong>
                            <span>
                                Try another search.
                            </span>
                        </div>
                    )}

                </div>
            </aside>

            {/* =========================================================
                RECIPE
               ========================================================= */}

            <section className="cyberchef-recipe">

                <header className="cyberchef-recipe-header">

                    <div>
                        <div className="cyberchef-section-title">

                            <span className="cyberchef-section-icon">
                                <Wand size={14} />
                            </span>

                            <div>
                                <span className="cyberchef-eyebrow">
                                    WORKFLOW
                                </span>

                                <strong>
                                    Tactical Recipe
                                </strong>
                            </div>
                        </div>

                        <div className="cyberchef-recipe-meta">
                            <span>
                                {recipe.length} STEP
                                {recipe.length !==
                                1
                                    ? 'S'
                                    : ''}
                            </span>

                            <span className="separator">
                                •
                            </span>

                            <span
                                className={
                                    activeRecipeCount >
                                    0
                                        ? 'ready'
                                        : ''
                                }
                            >
                                {activeRecipeCount >
                                0
                                    ? 'READY'
                                    : 'EMPTY'}
                            </span>
                        </div>
                    </div>

                    <div className="cyberchef-recipe-actions">

                        <button
                            type="button"
                            className="cyberchef-secondary-button"
                            onClick={
                                handleMagicWand
                            }
                            disabled={
                                !input ||
                                isCookingAi
                            }
                        >
                            {isCookingAi ? (
                                <Loader2
                                    size={13}
                                    className="animate-spin"
                                />
                            ) : (
                                <Sparkles
                                    size={13}
                                />
                            )}

                            {isCookingAi
                                ? 'ANALYZING'
                                : 'AI SUGGEST'}
                        </button>

                        <button
                            type="button"
                            className="cyberchef-quiet-button"
                            onClick={
                                clearRecipe
                            }
                            disabled={
                                recipe.length ===
                                0
                            }
                        >
                            CLEAR
                        </button>
                    </div>

                </header>

                <div className="cyberchef-recipe-body custom-scrollbar">

                    {recipe.length === 0 ? (
                        <div className="cyberchef-empty-recipe">

                            <div className="cyberchef-empty-recipe-icon">
                                <Plus size={20} />
                            </div>

                            <strong>
                                Build your recipe
                            </strong>

                            <span>
                                Select operations from
                                the library to create
                                an analysis pipeline.
                            </span>

                            <small>
                                Steps execute from top
                                to bottom.
                            </small>

                        </div>
                    ) : (
                        <div className="cyberchef-steps">

                            {recipe.map(
                                (
                                    step,
                                    index
                                ) => {
                                    const operation =
                                        OPERATIONS.find(
                                            (item) =>
                                                item.id ===
                                                step.opId
                                        );

                                    if (
                                        !operation
                                    ) {
                                        return null;
                                    }

                                    const Icon =
                                        operation.icon;

                                    return (
                                        <React.Fragment
                                            key={
                                                step.id
                                            }
                                        >

                                            <article
                                                className={`
                                                    cyberchef-step
                                                    ${
                                                        step.disabled
                                                            ? 'disabled'
                                                            : ''
                                                    }
                                                `}
                                            >

                                                <div className="cyberchef-step-header">

                                                    <div className="cyberchef-step-index">
                                                        {String(
                                                            index +
                                                                1
                                                        ).padStart(
                                                            2,
                                                            '0'
                                                        )}
                                                    </div>

                                                    <div className="cyberchef-step-icon">
                                                        <Icon
                                                            size={
                                                                14
                                                            }
                                                        />
                                                    </div>

                                                    <div className="cyberchef-step-heading">

                                                        <span className="cyberchef-eyebrow">
                                                            {
                                                                operation.category
                                                            }
                                                        </span>

                                                        <strong>
                                                            {
                                                                operation.name
                                                            }
                                                        </strong>

                                                    </div>

                                                    <div className="cyberchef-step-actions">

                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                toggleStep(
                                                                    step.id
                                                                )
                                                            }
                                                            title={
                                                                step.disabled
                                                                    ? 'Enable step'
                                                                    : 'Disable step'
                                                            }
                                                            className={
                                                                step.disabled
                                                                    ? 'muted'
                                                                    : 'active'
                                                            }
                                                        >
                                                            {step.disabled ? (
                                                                <Play
                                                                    size={
                                                                        13
                                                                    }
                                                                />
                                                            ) : (
                                                                <Pause
                                                                    size={
                                                                        13
                                                                    }
                                                                />
                                                            )}
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                removeStep(
                                                                    step.id
                                                                )
                                                            }
                                                            title="Remove step"
                                                            className="danger"
                                                        >
                                                            <X
                                                                size={
                                                                    13
                                                                }
                                                            />
                                                        </button>

                                                    </div>

                                                </div>

                                                {operation.args &&
                                                    operation
                                                        .args
                                                        .length >
                                                        0 &&
                                                    !step.disabled && (
                                                        <div className="cyberchef-step-settings">

                                                            {operation.args.map(
                                                                (
                                                                    argument
                                                                ) => (
                                                                    <div
                                                                        key={
                                                                            argument.name
                                                                        }
                                                                        className="cyberchef-field"
                                                                    >

                                                                        <label>
                                                                            {
                                                                                argument.name
                                                                            }
                                                                        </label>

                                                                        {argument.type ===
                                                                        'select' ? (
                                                                            <select
                                                                                value={
                                                                                    step
                                                                                        .args[
                                                                                        argument.name
                                                                                    ]
                                                                                }
                                                                                onChange={(
                                                                                    event
                                                                                ) =>
                                                                                    updateArg(
                                                                                        step.id,
                                                                                        argument.name,
                                                                                        event
                                                                                            .target
                                                                                            .value
                                                                                    )
                                                                                }
                                                                            >
                                                                                {argument.options?.map(
                                                                                    (
                                                                                        option
                                                                                    ) => (
                                                                                        <option
                                                                                            key={
                                                                                                option
                                                                                            }
                                                                                            value={
                                                                                                option
                                                                                            }
                                                                                        >
                                                                                            {
                                                                                                option
                                                                                            }
                                                                                        </option>
                                                                                    )
                                                                                )}
                                                                            </select>
                                                                        ) : argument.type ===
                                                                          'toggle' ? (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() =>
                                                                                    updateArg(
                                                                                        step.id,
                                                                                        argument.name,
                                                                                        !step
                                                                                            .args[
                                                                                            argument.name
                                                                                        ]
                                                                                    )
                                                                                }
                                                                                className={`
                                                                                    cyberchef-inline-toggle
                                                                                    ${
                                                                                        step
                                                                                            .args[
                                                                                            argument.name
                                                                                        ]
                                                                                            ? 'active'
                                                                                            : ''
                                                                                    }
                                                                                `}
                                                                            >
                                                                                {
                                                                                    step
                                                                                        .args[
                                                                                        argument.name
                                                                                    ]
                                                                                        ? 'ON'
                                                                                        : 'OFF'
                                                                                }
                                                                            </button>
                                                                        ) : (
                                                                            <input
                                                                                type={
                                                                                    argument.type ===
                                                                                    'number'
                                                                                        ? 'number'
                                                                                        : 'text'
                                                                                }
                                                                                value={
                                                                                    step
                                                                                        .args[
                                                                                        argument.name
                                                                                    ]
                                                                                }
                                                                                onChange={(
                                                                                    event
                                                                                ) =>
                                                                                    updateArg(
                                                                                        step.id,
                                                                                        argument.name,
                                                                                        argument.type ===
                                                                                        'number'
                                                                                            ? Number(
                                                                                                  event
                                                                                                      .target
                                                                                                      .value
                                                                                              )
                                                                                            : event
                                                                                                  .target
                                                                                                  .value
                                                                                    )
                                                                                }
                                                                            />
                                                                        )}

                                                                    </div>
                                                                )
                                                            )}

                                                        </div>
                                                    )}

                                            </article>

                                            {index <
                                                recipe.length -
                                                    1 && (
                                                <div className="cyberchef-step-connector">
                                                    <span>
                                                        ↓
                                                    </span>
                                                </div>
                                            )}

                                        </React.Fragment>
                                    );
                                }
                            )}

                        </div>
                    )}

                </div>

                <footer className="cyberchef-recipe-footer">

                    <button
                        type="button"
                        className={`
                            cyberchef-run-button
                            ${
                                isBaking
                                    ? 'running'
                                    : ''
                            }
                        `}
                        onClick={bake}
                        disabled={isBaking}
                    >
                        {isBaking ? (
                            <Loader2
                                size={15}
                                className="animate-spin"
                            />
                        ) : (
                            <Zap
                                size={15}
                                fill="currentColor"
                            />
                        )}

                        {isBaking
                            ? 'RUNNING RECIPE'
                            : 'RUN RECIPE'}
                    </button>

                    <div className="cyberchef-toggle-grid">

                        <label className="cyberchef-toggle-control">
                            <span>
                                AUTO-BAKE
                            </span>

                            <input
                                type="checkbox"
                                checked={
                                    autoBake
                                }
                                onChange={(
                                    event
                                ) =>
                                    setAutoBake(
                                        event.target
                                            .checked
                                    )
                                }
                            />

                            <span className="cyberchef-switch" />
                        </label>

                        <label className="cyberchef-toggle-control">
                            <span>
                                LINE BY LINE
                            </span>

                            <input
                                type="checkbox"
                                checked={
                                    forEachLine
                                }
                                onChange={(
                                    event
                                ) =>
                                    setForEachLine(
                                        event.target
                                            .checked
                                    )
                                }
                            />

                            <span className="cyberchef-switch" />
                        </label>

                    </div>

                </footer>
            </section>

            {/* =========================================================
                SOURCE / OUTPUT
               ========================================================= */}

            <section className="cyberchef-workspace">

                <article className="cyberchef-io-panel">

                    <header className="cyberchef-io-header">

                        <div className="cyberchef-io-title">
                            <span className="cyberchef-io-icon">
                                <ArrowRight
                                    size={13}
                                />
                            </span>

                            <div>
                                <span className="cyberchef-eyebrow">
                                    INPUT
                                </span>

                                <strong>
                                    Source Buffer
                                </strong>
                            </div>
                        </div>

                        <div className="cyberchef-io-actions">

                            <span>
                                {input.length.toLocaleString()}{' '}
                                BYTES
                            </span>

                            {input && (
                                <button
                                    type="button"
                                    onClick={
                                        clearInput
                                    }
                                    title="Clear input"
                                >
                                    <X size={13} />
                                </button>
                            )}

                        </div>

                    </header>

                    <textarea
                        value={input}
                        onChange={(event) =>
                            setInput(
                                event.target.value
                            )
                        }
                        placeholder="Paste data, hex bytes, encoded content, logs..."
                        className="cyberchef-source-editor custom-scrollbar"
                    />

                </article>

                <article className="cyberchef-io-panel">

                    <header className="cyberchef-io-header">

                        <div className="cyberchef-io-title">

                            <span className="cyberchef-io-icon result">
                                <CheckCircle
                                    size={13}
                                />
                            </span>

                            <div>
                                <span className="cyberchef-eyebrow">
                                    RESULT
                                </span>

                                <strong>
                                    Processed Output
                                </strong>
                            </div>

                        </div>

                        <div className="cyberchef-io-actions">

                            {output && (
                                <button
                                    type="button"
                                    onClick={
                                        handleCopy
                                    }
                                    className="cyberchef-copy-button"
                                >
                                    {copied ? (
                                        <Check
                                            size={13}
                                        />
                                    ) : (
                                        <Copy
                                            size={13}
                                        />
                                    )}

                                    {copied
                                        ? 'COPIED'
                                        : 'COPY'}
                                </button>
                            )}

                        </div>

                    </header>

                    <div className="cyberchef-output custom-scrollbar">

                        {output.startsWith(
                            'IMAGE_DATA:'
                        ) ? (
                            <div className="cyberchef-output-image">
                                <img
                                    src={
                                        output.split(
                                            'IMAGE_DATA:'
                                        )[1]
                                    }
                                    alt="Processed result"
                                />

                                <span>
                                    RENDERED IMAGE
                                </span>
                            </div>
                        ) : (
                            <>
                                {!output &&
                                    !isBaking && (
                                        <div className="cyberchef-output-empty">
                                            <FileSearch
                                                size={24}
                                            />

                                            <strong>
                                                Awaiting execution
                                            </strong>

                                            <span>
                                                Add operations
                                                to the recipe
                                                and run it to
                                                inspect the
                                                result.
                                            </span>
                                        </div>
                                    )}

                                {output && (
                                    <div
                                        className={`
                                            cyberchef-output-text
                                            ${
                                                isBaking
                                                    ? 'processing'
                                                    : ''
                                            }
                                        `}
                                    >
                                        {renderInteractiveOutput(
                                            output
                                        )}
                                    </div>
                                )}
                            </>
                        )}

                        {(isBaking ||
                            isCookingAi) && (
                            <div className="cyberchef-processing">

                                <div className="cyberchef-processing-card">
                                    <RefreshCw
                                        size={14}
                                        className="animate-spin"
                                    />

                                    <span>
                                        {isCookingAi
                                            ? 'AI IS ANALYZING THE INPUT'
                                            : 'RUNNING RECIPE'}
                                    </span>
                                </div>

                            </div>
                        )}

                    </div>

                </article>

            </section>
        </div>
    );
};

const Loader2 = ({ className, size }: { className?: string, size?: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg>
);
