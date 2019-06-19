import React from 'react';
import { Sankey } from 'react-vis';

import YNABSankey from './ynab-sankey';

function App() {
  const [{ nodes, links }, setState] = React.useState({ nodes: [], links: [] });

  React.useEffect(() => {
    const getSankey = async () => {
      const ynabSankey = new YNABSankey(localStorage.getItem('token'));
      const { nodes, links } = await ynabSankey.getSankeyForBudgetMonth(
        localStorage.getItem('budgetId')
      );

      setState({ nodes, links });
    };

    getSankey();
  }, []);

  return (
    <div>
      <Sankey
        nodes={nodes}
        links={links}
        width={900}
        height={900}
        align="left"
      />
    </div>
  );
}

export default App;
