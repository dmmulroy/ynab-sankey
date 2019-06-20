import * as ynab from 'ynab';

class Client {
  constructor(token) {
    if (!token) throw new Error('must provide a ynab token');
    this.token = token;
    this.ynabAPI = new ynab.API(token);
    this._sankey = null;
  }

  getSankeyForBudgetMonth = async (budgetId, month = 'current') => {
    if (!budgetId) {
      throw new Error('must provide a budgetId');
    }

    try {
      const {
        data: categoryData
      } = await this.ynabAPI.categories.getCategories(budgetId);

      const { category_groups } = categoryData;

      const { data: monthData } = await this.ynabAPI.months.getBudgetMonth(
        budgetId,
        month
      );

      this._sankey = new YNABSankey(category_groups, monthData.month);
      return { nodes: this._sankey.getNodes(), links: this._sankey.getLinks() };
    } catch (error) {
      throw new Error(`error creating YNABSankey: ${error}`);
    }
  };
}

class YNABSankey {
  constructor(categoryGroups, month) {
    this.root = {
      id: '__ROOT__',
      name: 'Budgeted Income',
      value: month.budgeted,
      children: []
    };
    this._nodes = [];
    this._links = [];

    this._buildSankey(categoryGroups, month);
  }

  _buildSankey = (categoryGroups, month) => {
    const categoriesByGroupId = month.categories.reduce((acc, category) => {
      if (acc[category.category_group_id]) {
        acc[category.category_group_id].push(category);
      } else {
        acc[category.category_group_id] = [category];
      }
      return acc;
    }, {});

    categoryGroups.forEach(categoryGroup => {
      if (
        categoryGroup.hidden ||
        categoryGroup.deleted ||
        !categoriesByGroupId[categoryGroup.id]
      )
        return;

      let categoryGroupBudgeted = 0;

      const categoryNodes = categoriesByGroupId[categoryGroup.id].reduce(
        (acc, category) => {
          if (category.hidden || category.deleted || category.budgeted === 0)
            return acc;

          categoryGroupBudgeted += category.budgeted;

          acc.push({
            id: category.id,
            name: category.name,
            value: category.budgeted,
            children: []
          });

          return acc;
        },
        []
      );

      if (categoryGroupBudgeted === 0) return;

      const node = {
        id: categoryGroup.id,
        name: categoryGroup.name,
        value: categoryGroupBudgeted,
        children: categoryNodes
      };

      this.root.children.push(node);
    });
  };

  _insertCategoryGroupNode = categoryGroup => {
    if (categoryGroup.hidden || categoryGroup.deleted) return;

    let categoryGroupBudgeted = 0;

    const categoryNodes = categoryGroup.categories.reduce((acc, category) => {
      if (category.hidden || category.deleted || category.budgeted === 0)
        return acc;

      categoryGroupBudgeted += category.budgeted;

      acc.push({
        id: category.id,
        name: category.name,
        value: category.budgeted,
        children: []
      });

      return acc;
    }, []);

    if (categoryGroupBudgeted === 0) return;

    const node = {
      id: categoryGroup.id,
      name: categoryGroup.name,
      value: categoryGroupBudgeted,
      children: categoryNodes
    };

    this.root.children.push(node);
  };

  getNodes = () => {
    if (this._nodes.length > 0) return this._nodes;

    const _getNodes = (node, nodes = []) => {
      nodes.push(node);

      for (let child of node.children) {
        _getNodes(child, nodes);
      }

      return nodes;
    };

    this._nodes = _getNodes(this.root);
    return [...this._nodes];
  };

  getLinks = () => {
    if (this._links.length > 0) return this._links;

    if (this._nodes.length === 0) {
      this.getNodes();
    }

    const indexLookup = this._nodes.reduce((lookup, node, idx) => {
      lookup[node.id] = idx;

      return lookup;
    }, {});

    const _getLinks = (node, links = []) => {
      for (let child of node.children) {
        if (child.children.length > 0) {
          _getLinks(child, links);
        }

        links.push({
          source: indexLookup[node.id],
          target: indexLookup[child.id],
          value: child.value
        });
      }

      return links;
    };

    this._links = _getLinks(this.root);

    return [...this._links];
  };
}

export default Client;
