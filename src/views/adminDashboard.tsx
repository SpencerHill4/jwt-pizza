import React from 'react';
import View from './view';
import { useLocation, useNavigate } from 'react-router-dom';
import NotFound from './notFound';
import Button from '../components/button';
import { pizzaService } from '../service/service';
import { Franchise, FranchiseList, Role, Store, User, UserList } from '../service/pizzaService';
import { TrashIcon } from '../icons';

interface Props {
  user: User | null;
}

interface FilterPaginationProps {
  placeholder: string;
  page: number;
  firstPage: number;
  more: boolean;
  columnCount: number;
  onPageChange: (page: number) => void;
  onFilter: (filter: string) => void;
}

function FilterPagination(props: FilterPaginationProps) {
  const [filterInput, setFilterInput] = React.useState('');

  function submitFilter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    props.onPageChange(props.firstPage);
    props.onFilter(filterInput);
  }

  return (
    <tfoot>
      <tr>
        <td className="px-1 py-1">
          <form onSubmit={submitFilter}>
            <input
              type="text"
              value={filterInput}
              onChange={(event) => setFilterInput(event.target.value)}
              placeholder={props.placeholder}
              className="px-2 py-1 text-sm border border-gray-300 rounded-lg"
            />
            <button
              type="submit"
              className="ml-2 px-2 py-1 text-sm font-semibold rounded-lg border border-orange-400 text-orange-400 hover:border-orange-800 hover:text-orange-800"
            >
              Submit
            </button>
          </form>
        </td>
        <td colSpan={props.columnCount - 1} className="text-end text-sm font-medium">
          <button
            type="button"
            className="w-12 p-1 text-sm font-semibold rounded-lg border border-transparent bg-white text-grey border-grey m-1 hover:bg-orange-200 disabled:bg-neutral-300"
            onClick={() => props.onPageChange(props.page - 1)}
            disabled={props.page <= props.firstPage}
            aria-label="Previous page"
          >
            «
          </button>
          <button
            type="button"
            className="w-12 p-1 text-sm font-semibold rounded-lg border border-transparent bg-white text-grey border-grey m-1 hover:bg-orange-200 disabled:bg-neutral-300"
            onClick={() => props.onPageChange(props.page + 1)}
            disabled={!props.more}
            aria-label="Next page"
          >
            »
          </button>
        </td>
      </tr>
    </tfoot>
  );
}

export default function AdminDashboard(props: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = React.useState<'franchises' | 'users'>(
    location.state?.activeTab === 'users' ? 'users' : 'franchises',
  );
  const [franchiseList, setFranchiseList] = React.useState<FranchiseList>({ franchises: [], more: false });
  const [franchisePage, setFranchisePage] = React.useState(0);
  const [franchiseFilter, setFranchiseFilter] = React.useState('');
  const [userList, setUserList] = React.useState<UserList>({ users: [], more: false });
  const [userPage, setUserPage] = React.useState(1);
  const [userFilter, setUserFilter] = React.useState('');

  React.useEffect(() => {
    (async () => {
      setFranchiseList(await pizzaService.getFranchises(franchisePage, 3, `*${franchiseFilter}*`));
    })();
  }, [props.user, franchisePage, franchiseFilter]);

  React.useEffect(() => {
    if (activeTab !== 'users') return;
    (async () => {
      setUserList(await pizzaService.getUsers(userPage, 3, `*${userFilter}*`));
    })();
  }, [props.user, activeTab, userPage, userFilter]);

  function createFranchise() {
    navigate('/admin-dashboard/create-franchise');
  }

  async function closeFranchise(franchise: Franchise) {
    navigate('/admin-dashboard/close-franchise', { state: { franchise: franchise } });
  }

  async function closeStore(franchise: Franchise, store: Store) {
    navigate('/admin-dashboard/close-store', { state: { franchise: franchise, store: store } });
  }

  function deleteUser(user: User) {
    navigate('/admin-dashboard/delete-user', {
      state: { user, activeTab: 'users' },
    });
  }

  let response = <NotFound />;
  if (Role.isRole(props.user, Role.Admin)) {
    response = (
      <View title="Mama Ricci's kitchen">
        <div className="text-start py-8 px-4 sm:px-6 lg:px-8">
          <div
            role="tablist"
            aria-label="Admin sections"
            className="--prevent-on-load-init flex gap-2"
          >
            <button
              id="franchises-tab"
              type="button"
              role="tab"
              aria-selected={activeTab === 'franchises'}
              aria-controls="franchises-panel"
              className={`px-3 py-2 text-xl text-neutral-100 border-b-2 ${activeTab === 'franchises' ? 'border-orange-400' : 'border-transparent'}`}
              onClick={() => setActiveTab('franchises')}
            >
              Franchises
            </button>
            <button
              id="users-tab"
              type="button"
              role="tab"
              aria-selected={activeTab === 'users'}
              aria-controls="users-panel"
              className={`px-3 py-2 text-xl text-neutral-100 border-b-2 ${activeTab === 'users' ? 'border-orange-400' : 'border-transparent'}`}
              onClick={() => setActiveTab('users')}
            >
              Users
            </button>
          </div>
          {activeTab === 'franchises' ? (
            <section id="franchises-panel" role="tabpanel" aria-labelledby="franchises-tab">
              <div className="bg-neutral-100 overflow-clip my-4">
                <div className="flex flex-col">
                  <div className="-m-1.5 overflow-x-auto">
                    <div className="p-1.5 min-w-full inline-block align-middle">
                      <div className="overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="uppercase text-neutral-100 bg-slate-400 border-b-2 border-gray-500">
                            <tr>
                              {['Franchise', 'Franchisee', 'Store', 'Revenue', 'Action'].map((header) => (
                                <th key={header} scope="col" className="px-6 py-3 text-center text-xs font-medium">
                                  {header}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          {franchiseList.franchises.map((franchise, findex) => {
                            return (
                              <tbody key={findex} className="divide-y divide-gray-200">
                                <tr className="border-neutral-500 border-t-2">
                                  <td className="text-start px-2 whitespace-nowrap text-l font-mono text-orange-600">{franchise.name}</td>
                                  <td className="text-start px-2 whitespace-nowrap text-sm font-normal text-gray-800" colSpan={3}>
                                    {franchise.admins?.map((o) => o.name).join(', ')}
                                  </td>
                                  <td className="px-6 py-1 whitespace-nowrap text-end text-sm font-medium">
                                    <button type="button" className="px-2 py-1 inline-flex items-center gap-x-2 text-sm font-semibold rounded-lg border border-1 border-orange-400 text-orange-400  hover:border-orange-800 hover:text-orange-800" onClick={() => closeFranchise(franchise)}>
                                      <TrashIcon />
                                      Close
                                    </button>
                                  </td>
                                </tr>

                                {franchise.stores.map((store, sindex) => {
                                  return (
                                    <tr key={sindex} className="bg-neutral-100">
                                      <td className="text-end px-2 whitespace-nowrap text-sm text-gray-800" colSpan={3}>
                                        {store.name}
                                      </td>
                                      <td className="text-end px-2 whitespace-nowrap text-sm text-gray-800">{store.totalRevenue?.toLocaleString()} ₿</td>
                                      <td className="px-6 py-1 whitespace-nowrap text-end text-sm font-medium">
                                        <button type="button" className="px-2 py-1 inline-flex items-center gap-x-2 text-sm font-semibold rounded-lg border border-1 border-orange-400 text-orange-400 hover:border-orange-800 hover:text-orange-800" onClick={() => closeStore(franchise, store)}>
                                          <TrashIcon />
                                          Close
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            );
                          })}
                          <FilterPagination
                            placeholder="Filter franchises"
                            page={franchisePage}
                            firstPage={0}
                            more={franchiseList.more}
                            columnCount={5}
                            onPageChange={setFranchisePage}
                            onFilter={setFranchiseFilter}
                          />
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <section id="users-panel" role="tabpanel" aria-labelledby="users-tab">
              <div className="bg-neutral-100 overflow-clip my-4">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="uppercase text-neutral-100 bg-slate-400 border-b-2 border-gray-500">
                      <tr>
                        {['Name', 'Email', 'Role', 'Action'].map((header) => (
                          <th key={header} scope="col" className="px-6 py-3 text-center text-xs font-medium">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {userList.users.map((user) => (
                        <tr key={user.id ?? user.email} className="divide-y divide-gray-200">
                          <td className="text-start px-2 whitespace-nowrap text-sm text-gray-800">{user.name}</td>
                          <td className="text-start px-2 whitespace-nowrap text-sm text-gray-800">{user.email}</td>
                          <td className="text-start px-2 whitespace-nowrap text-sm text-gray-800">
                            {user.roles?.map(({ role }) => role).join(', ')}
                          </td>
                          <td className="px-6 py-1 whitespace-nowrap text-end text-sm font-medium">
                            <button
                              type="button"
                              className="px-2 py-1 inline-flex items-center gap-x-2 text-sm font-semibold rounded-lg border border-orange-400 text-orange-400 hover:border-orange-800 hover:text-orange-800 disabled:opacity-50"
                              onClick={() => deleteUser(user)}
                              disabled={!user.id}
                            >
                              <TrashIcon />
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                      {userList.users.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-600">
                            No users found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <FilterPagination
                      placeholder="Filter users"
                      page={userPage}
                      firstPage={1}
                      more={userList.more}
                      columnCount={4}
                      onPageChange={setUserPage}
                      onFilter={setUserFilter}
                    />
                  </table>
                </div>
              </div>
            </section>
          )}
        </div>
        {activeTab === 'franchises' && (
          <div>
            <Button className="w-36 text-xs sm:text-sm sm:w-64" title="Add Franchise" onPress={createFranchise} />
          </div>
        )}
      </View>
    );
  }

  return response;
}
