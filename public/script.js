
document.addEventListener("DOMContentLoaded", function() {
    console.log("Script Loaded");
    var editProfileBtn1 = document.getElementById("edit-profile-btn-1");
    var editProfileBtn2 = document.getElementById("edit-profile-btn-2");
    var formContainer = document.getElementById("form-container");

    editProfileBtn1.addEventListener("click", function() {
        Toggle_edit_profile(formContainer, editProfileBtn1);
    });

    editProfileBtn2.addEventListener("click", function() {
        Toggle_edit_profile(formContainer, editProfileBtn2);
    });
});

function Toggle_edit_profile(formContainer, editProfileBtn) {
    if (formContainer.style.display === "none") {
        formContainer.style.display = "block";
        editProfileBtn.style.display = "none";
    } else {
        formContainer.style.display = "none";
        editProfileBtn.style.display = "block";
    }
}