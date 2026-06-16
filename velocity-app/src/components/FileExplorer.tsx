import { useState } from 'react';
import type { FileNode } from '../types';

interface FileExplorerProps {
  nodes: FileNode[];
  depth: number;
  activePath: string | null;
  onSelect: (node: FileNode) => void;
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void;
}

interface FileTreeNodeProps {
  node: FileNode;
  depth: number;
  activePath: string | null;
  onSelect: (node: FileNode) => void;
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void;
}

function getFileIcon(node: FileNode): string {
  if (node.is_dir) return '\ud83d\udcc1';
  const ext = node.name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts': case 'tsx': return '\ud83d\udfe3';
    case 'js': case 'jsx': return '\ud83d\udfe8';
    case 'rs': return '\ud83e\ude84';
    case 'py': return '\ud83d\udfe9';
    case 'css': case 'scss': return '\ud83d\udfe6';
    case 'json': return '\u2699\ufe0f';
    case 'html': return '\ud83c\udf10';
    case 'md': return '\ud83d\udcdd';
    case 'toml': return '\u2699\ufe0f';
    case 'yaml': case 'yml': return '\u2699\ufe0f';
    default: return '\ud83d\udcc4';
  }
}

function FileTreeNode({ node, depth, activePath, onSelect, onContextMenu }: FileTreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 1);

  const handleClick = () => {
    if (node.is_dir) {
      setExpanded(!expanded);
    } else {
      onSelect(node);
    }
  };

  return (
    <>
      <div
        className={`file-tree-item${activePath === node.path ? ' active' : ''}`}
        style={{ '--depth': depth } as React.CSSProperties}
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, node)}
      >
        {node.is_dir ? (
          <span className={`chevron${expanded ? ' open' : ''}`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </span>
        ) : (
          <span className="chevron" />
        )}
        <span className="file-icon">{getFileIcon(node)}</span>
        <span className="file-name">{node.name}</span>
      </div>
      {expanded && node.children?.map((child) => (
        <FileTreeNode
          key={child.path}
          node={child}
          depth={depth + 1}
          activePath={activePath}
          onSelect={onSelect}
          onContextMenu={onContextMenu}
        />
      ))}
    </>
  );
}

export function FileExplorer({ nodes, depth, activePath, onSelect, onContextMenu }: FileExplorerProps) {
  return (
    <>
      {nodes.map((node) => (
        <FileTreeNode
          key={node.path}
          node={node}
          depth={depth}
          activePath={activePath}
          onSelect={onSelect}
          onContextMenu={onContextMenu}
        />
      ))}
    </>
  );
}
