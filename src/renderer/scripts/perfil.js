document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('profileForm');
  const inputs = form.querySelectorAll('input, select');
  const updateBtn = document.getElementById('updateBtn');
  const editBtn = document.getElementById('edit-personal-btn');
  const cancelBtn = document.getElementById('cancel-edit-btn');
  const actions = document.getElementById('form-actions');

  const profileName = document.getElementById('profile-name');
  const profileRole = document.getElementById('profile-role');

  const nombre = document.getElementById('nombre');
  const apellido = document.getElementById('apellido');
  const email = document.getElementById('email');
  const telefono = document.getElementById('telefono');
  const nacimiento = document.getElementById('nacimiento');
  const rol = document.getElementById('rol');

  // ============================
  // 🔹 Cargar datos del usuario
  // ============================
  try {
    // Intentar cargar desde la sesión actual (localStorage) o desde la API
    let userData;
    const sesion = JSON.parse(localStorage.getItem('sesionActual') || '{}');
    const userId = sesion.id;

    if (userId && window.api?.getUserProfile) {
      try {
        userData = await window.api.getUserProfile({ id: userId });
      } catch (err) {
        console.warn('getUserProfile falló, usando localStorage si existe', err);
      }
    }

    if (!userData) {
      const storedUser = localStorage.getItem('usuarioActual') || localStorage.getItem('sesionActual');
      if (storedUser) userData = JSON.parse(storedUser);
    }

    if (userData) {
      nombre.value = userData.nombre || '';
      apellido.value = userData.apellidos || '';
      email.value = userData.email || '';
      telefono.value = userData.telefono || '';
      nacimiento.value = userData.nacimiento || userData.fecha_nacimiento || '';
      rol.value = userData.rol || '';

      profileName.textContent = `${userData.nombre || ''} ${userData.apellido || ''}`.trim();
      profileRole.textContent = userData.rol || 'Sin rol';
    }
  } catch (err) {
    console.error('Error al cargar datos:', err);
  }

  // ============================
  // 🔹 Activar modo edición
  // ============================
  editBtn.addEventListener('click', () => {
    inputs.forEach(i => i.disabled = false);
    actions.classList.remove('hidden');
    editBtn.style.display = 'none';
  });

  // ============================
  // 🔹 Cancelar edición
  // ============================
  cancelBtn.addEventListener('click', () => {
    inputs.forEach(i => i.disabled = true);
    actions.classList.add('hidden');
    editBtn.style.display = 'flex';
  });

  // ============================
  // 🔹 Guardar cambios
  // ============================
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const profileData = {
      id: (JSON.parse(localStorage.getItem('sesionActual') || '{}')).id,
      nombre: nombre.value,
      apellido: apellido.value,
      email: email.value,
      telefono: telefono.value,
      nacimiento: nacimiento.value,
      rol: rol.value
    };

    try {
      if (window.api?.updateUserProfile) {
        await window.api.updateUserProfile(profileData);
      }

      // actualizar cache local
      localStorage.setItem('usuarioActual', JSON.stringify(profileData));

      profileName.textContent = `${profileData.nombre} ${profileData.apellido}`.trim();
      profileRole.textContent = profileData.rol || 'Sin rol';

      alert('Perfil actualizado correctamente');

      inputs.forEach(i => i.disabled = true);
      actions.classList.add('hidden');
      editBtn.style.display = 'flex';

    } catch (err) {
      alert('Error al actualizar perfil: ' + (err.message || err));
    }
  });
});
